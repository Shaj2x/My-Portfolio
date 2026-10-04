"""Live simulation: every demo device publishes over MQTT in real time and
obeys control commands, so the whole system runs closed-loop without hardware."""
from __future__ import annotations

import json
import logging
import random
import threading
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

import paho.mqtt.client as mqtt
import psycopg

from . import catalog, models

log = logging.getLogger("marq_sim")
TELEMETRY_EVERY = 5.0


def ms(t: float) -> int:
    return int(t * 1000)


class Device:
    """One MQTT connection per device, so each has its own Last Will."""

    def __init__(self, url: str, hw: str, on_cmd=None, username: str | None = None, password: str | None = None):
        self.hw = hw
        u = urlparse(url)
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=hw, clean_session=True)
        if username:
            self.client.username_pw_set(username, password)
        self.client.will_set(f"marq/dev/{hw}/status", json.dumps({"state": "offline"}), qos=1, retain=True)
        self.on_cmd = on_cmd
        self.client.on_connect = self._connected
        self.client.on_message = self._message
        self.client.connect_async(u.hostname or "localhost", u.port or 1883, keepalive=30)
        self.client.loop_start()
        self.seq = 0

    def _connected(self, client, _userdata, _flags, rc, _props=None):
        if rc != 0:
            log.warning("%s connect failed: %s", self.hw, rc)
            return
        client.publish(f"marq/dev/{self.hw}/status", json.dumps(
            {"state": "online", "fw": "sim-1.0", "rssi": random.randint(-72, -48), "uptime_s": 0, "buffered": 0}), qos=1, retain=True)
        if self.on_cmd:
            client.subscribe(f"marq/dev/{self.hw}/cmd", qos=1)

    def _message(self, _client, _userdata, msg):
        try:
            cmd = json.loads(msg.payload)
        except ValueError:
            return
        ok, err = self.on_cmd(cmd)
        ack = {"id": cmd.get("id"), "ok": ok}
        if err:
            ack["error"] = err
        self.client.publish(f"marq/dev/{self.hw}/ack", json.dumps(ack), qos=1)

    def telemetry(self, now: float, channels: list[dict]) -> None:
        self.seq += 1
        self.client.publish(f"marq/dev/{self.hw}/telemetry", json.dumps({"ts": ms(now), "seq": self.seq, "channels": channels}), qos=1)

    def event(self, now: float, **body) -> None:
        self.client.publish(f"marq/dev/{self.hw}/event", json.dumps({"ts": ms(now), **body}), qos=1)

    def close(self) -> None:
        # Clean shutdown also announces offline (the will only fires on a crash).
        self.client.publish(f"marq/dev/{self.hw}/status", json.dumps({"state": "offline"}), qos=1, retain=True).wait_for_publish(2)
        self.client.disconnect()
        self.client.loop_stop()


class Counter:
    """Lifetime energy counters per channel (Wh), like the firmware keeps in NVS."""

    def __init__(self):
        self.wh: dict[tuple[str, int], float] = {}
        self.last: dict[tuple[str, int], tuple[float, float]] = {}

    def channel(self, hw: str, ch: int, now: float, watts: float, volts: float = 120.0) -> dict:
        k = (hw, ch)
        if k in self.last:
            t0, w0 = self.last[k]
            self.wh[k] = self.wh.get(k, 0.0) + (w0 + watts) / 2 * (now - t0) / 3600
        self.last[k] = (now, watts)
        return {"ch": ch, "current_a": round(watts / volts, 3), "power_w": round(watts, 1), "energy_wh": round(self.wh.get(k, 0.0), 2)}


class Sim:
    def __init__(self, mqtt_url: str, app_dsn: str, drive_shuttle: bool = False, faults: list[str] | None = None,
                 seed: int | None = None, mqtt_user: str | None = None, mqtt_password: str | None = None):
        self.rng = random.Random(seed)
        self.app_dsn = app_dsn
        self.drive_shuttle = drive_shuttle
        self.counter = Counter()
        self.stop = threading.Event()
        self.lock = threading.Lock()
        auth = dict(username=mqtt_user, password=mqtt_password)

        faults = set(faults or [])
        self.machines = {(hw, ch): models.Machine(kind, heater_failed=label.lower().replace(" ", "-") in faults, rng=self.rng)
                         for label, kind, hw, ch in catalog.LAUNDRY}
        self.rooms = {slug: models.Room(lights_w=r["lights_w"], hvac_comfort_w=r["hvac_w"]) for slug, r in catalog.ROOMS.items()}
        self.chargers = {hw: models.Charger(max_kw=kw) for _, hw, kw, _ in catalog.CHARGERS}
        self.battery = models.Battery()
        self.occupied: dict[str, bool] = {slug: False for slug in self.rooms}
        self.next_motion: dict[str, float] = {slug: 0.0 for slug in self.rooms}
        self.shuttle_driving = False

        self.dev: dict[str, Device] = {}
        for hw, _name, typ, *_ in catalog.DEVICES:
            handler = None
            if typ == "relay":
                slug = next(s for s, r in catalog.ROOMS.items() if r["relay"] == hw)
                handler = lambda cmd, s=slug, h=hw: self._room_cmd(h, s, cmd)
            elif typ == "ev_charger":
                handler = lambda cmd, h=hw: self._ev_cmd(h, cmd)
            self.dev[hw] = Device(mqtt_url, hw, handler, **auth)

        # Watch the automation engine's heartbeat for fail-safe.
        u = urlparse(mqtt_url)
        self.hb = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="sim-heartbeat-watch")
        if mqtt_user:
            self.hb.username_pw_set(mqtt_user, mqtt_password)
        self.hb.on_connect = lambda c, *_: c.subscribe("marq/sys/heartbeat", qos=1)
        self.hb.on_message = lambda *_: self._heartbeat()
        self.hb.connect_async(u.hostname or "localhost", u.port or 1883, keepalive=30)
        self.hb.loop_start()

    # --- command handlers (called on MQTT threads) -------------------------------------

    def _room_cmd(self, hw: str, slug: str, cmd: dict):
        with self.lock:
            room = self.rooms[slug]
            if "relay" in cmd:
                out = {0: "lights", 1: "hvac"}.get(cmd["relay"].get("ch"))
                if out is None:
                    return False, "unknown relay channel"
                ok, err = room.command(out, cmd["relay"].get("state", ""))
            elif "hvac" in cmd:
                ok, err = room.command("hvac", cmd["hvac"].get("mode", ""))
            else:
                return False, "unsupported command"
        if ok:
            # Report the resulting output state, like the firmware does.
            ch = cmd["relay"]["ch"] if "relay" in cmd else 1
            on = room.lights_on if ch == 0 else room.hvac_mode == "comfort"
            self.dev[hw].event(time.time(), type="relay", ch=ch, state="on" if on else "off", source="command")
        return ok, err

    def _ev_cmd(self, hw: str, cmd: dict):
        if "ev" not in cmd:
            return False, "unsupported command"
        with self.lock:
            limit = float(cmd["ev"].get("limit_kw", 0))
            self.chargers[hw].limit_kw = max(0.0, min(limit, self.chargers[hw].max_kw))
        return True, None

    def _heartbeat(self):
        now = time.time()
        with self.lock:
            for room in self.rooms.values():
                room.heartbeat(now)

    # --- app DB polling -------------------------------------------------------------------

    def refresh_from_app(self) -> None:
        """Occupancy from bookings; plugged-in EVs from sessions."""
        now = datetime.now(timezone.utc)
        try:
            with psycopg.connect(self.app_dsn, autocommit=True) as conn:
                rows = conn.execute("""
                    select r.slug from public.bookings b join public.rooms r on r.amenity_id = b.amenity_id
                     where b.status = 'confirmed'
                       and lower(b.period) + interval '5 min' <= %s and upper(b.period) - interval '5 min' > %s""", (now, now)).fetchall()
                busy = {r[0] for r in rows}
                sessions = conn.execute("""
                    select d.hardware_id, s.requested_kwh - s.delivered_kwh
                      from public.ev_sessions s join public.ev_chargers c on c.id = s.charger_id join public.devices d on d.id = c.device_id
                     where s.status in ('scheduled', 'charging', 'paused') and s.departure_time > %s""", (now,)).fetchall()
        except psycopg.Error as e:
            log.warning("app DB unavailable: %s", e)
            return
        with self.lock:
            for slug in self.rooms:
                # Occasionally someone uses a room without booking (staff get alerted).
                self.occupied[slug] = slug in busy or (self.occupied[slug] and self.rng.random() < 0.9) or self.rng.random() < 0.002
            plugged = {hw: float(kwh) for hw, kwh in sessions}
            for hw, ch in self.chargers.items():
                if hw == "sim-ev-p1-04":
                    continue  # the shuttle's charger
                if hw in plugged and not ch.connected:
                    ch.plug_in(max(plugged[hw], 0.0))
                elif hw not in plugged and ch.connected:
                    ch.unplug()

    # --- main loop --------------------------------------------------------------------------

    def tick(self, now: float, dt: float) -> None:
        local = datetime.fromtimestamp(now).astimezone()
        hour = local.hour + local.minute / 60
        with self.lock:
            # Laundry.
            by_node: dict[str, list[dict]] = {}
            for (hw, ch), m in self.machines.items():
                p_start = models.laundry_arrival_rate(local.hour, local.weekday() >= 5) * dt / 3600
                if self.rng.random() < p_start:
                    m.start(now)
                by_node.setdefault(hw, []).append(self.counter.channel(hw, ch, now, m.power(now)))
            # Rooms.
            for slug, room in self.rooms.items():
                if room.check_failsafe(now):
                    self.dev[catalog.ROOMS[slug]["relay"]].event(now, type="relay", ch=0, state="on", source="failsafe")
                lights, hvac = room.power(now, self.rng)
                hw = catalog.ROOMS[slug]["ct"]
                by_node[hw] = [self.counter.channel(hw, 0, now, lights), self.counter.channel(hw, 1, now, hvac)]
                if self.occupied[slug] and now >= self.next_motion[slug]:
                    self.dev[catalog.ROOMS[slug]["pir"]].event(now, type="motion", ch=0, value=1)
                    self.next_motion[slug] = now + self.rng.uniform(20, 45)
            by_node["sim-ct-lobby"] = [self.counter.channel("sim-ct-lobby", 0, now, models.lobby_power(hour, self.rng))]
            # EV chargers (P1-04 charges the shuttle between runs).
            for hw, ch in self.chargers.items():
                if hw == "sim-ev-p1-04":
                    if not self.shuttle_driving and self.battery.soc_pct < 100:
                        kw = min(ch.max_kw, ch.limit_kw if ch.limit_kw is not None else ch.max_kw)
                        w = self.battery.charge(kw, dt)
                    else:
                        w = 0.0
                    ch.energy_counter_wh += w * dt / 3600
                else:
                    w = ch.step(dt)
                by_node[hw] = [{"ch": 0, "current_a": round(w / 240, 3), "power_w": round(w, 1), "energy_wh": round(ch.energy_counter_wh, 2)}]
            soc = self.battery.soc_pct
        for hw, channels in by_node.items():
            self.dev[hw].telemetry(now, channels)
        if int(now) % 30 < TELEMETRY_EVERY:
            self.dev["sim-shuttle-ev"].event(now, type="soc", value=round(soc, 1))

    def run(self) -> None:
        log.info("simulating %d devices", len(self.dev))
        last_refresh = 0.0
        last = time.time()
        if self.drive_shuttle:
            threading.Thread(target=self._shuttle_loop, daemon=True).start()
        while not self.stop.is_set():
            now = time.time()
            if now - last_refresh > 30:
                self.refresh_from_app()
                last_refresh = now
            self.tick(now, now - last if now > last else TELEMETRY_EVERY)
            last = now
            self.stop.wait(TELEMETRY_EVERY)
        for d in self.dev.values():
            d.close()
        self.hb.loop_stop()

    # --- demo shuttle driver -------------------------------------------------------------

    def _shuttle_loop(self) -> None:
        """Acts as the driver for runs that are due, posting GPS like the driver app."""
        while not self.stop.is_set():
            try:
                with psycopg.connect(self.app_dsn, autocommit=True) as conn:
                    row = conn.execute("""
                        update public.runs set status = 'active', started_at = now()
                         where id = (select id from public.runs where status = 'scheduled'
                                        and scheduled_departure + make_interval(mins => coalesce(delay_minutes, 0)) between now() - interval '3 min' and now()
                                        and not exists (select 1 from public.runs a where a.status = 'active' and a.route_id = runs.route_id)
                                      order by scheduled_departure limit 1)
                        returning id, route_id""").fetchone()
                    if row:
                        self._drive(conn, *row)
            except psycopg.Error as e:
                log.warning("shuttle loop: %s", e)
            self.stop.wait(20)

    def _drive(self, conn, run_id, route_id) -> None:
        stops = conn.execute("select lat, lng from public.stops where route_id = %s order by sequence", (route_id,)).fetchall()
        path = [(float(a), float(b)) for a, b in stops]
        if len(path) < 2:
            return
        log.info("shuttle run %s started", run_id)
        self.shuttle_driving = True
        meters, speed, last_pos = 0.0, 8.0, path[0]
        while not self.stop.is_set():
            pos, done = models.position_along(path, meters)
            conn.execute("insert into public.shuttle_locations (run_id, lat, lng, speed_mps, accuracy_m) values (%s, %s, %s, %s, 6)",
                         (run_id, pos[0], pos[1], speed))
            with self.lock:
                self.battery.drive(models.haversine_m(last_pos, pos) / 1000)
            last_pos = pos
            if done:
                break
            self.stop.wait(5)
            meters += speed * 5 * self.rng.uniform(0.6, 1.2)
        conn.execute("update public.runs set status = 'completed', ended_at = now() where id = %s", (run_id,))
        conn.execute("select public.compute_run_metrics(%s)", (run_id,))
        conn.execute("delete from public.shuttle_locations where run_id = %s", (run_id,))
        self.shuttle_driving = False
        log.info("shuttle run %s completed", run_id)
