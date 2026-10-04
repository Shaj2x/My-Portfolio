"""Writes weeks of realistic history straight into TimescaleDB (1-minute
readings) and the app DB (completed shuttle runs with metrics), so
forecasting and analytics have data in demo mode. Live MQTT replay is
limited to 24 h, so history goes in directly."""
from __future__ import annotations

import logging
import random
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import psycopg

from . import catalog, models

log = logging.getLogger("marq_sim")
TZ = ZoneInfo("America/Toronto")


def _device_ids(app) -> dict[str, str]:
    return {hw: str(i) for i, hw in app.execute("select id, hardware_id from public.devices where simulated").fetchall()}


def room_schedule(day: datetime, rng: random.Random) -> list[tuple[datetime, datetime]]:
    """Synthetic bookings: evenings on weekdays, afternoons + evenings on weekends."""
    weekend = day.weekday() >= 5
    out = []
    for start_h in ([14, 17, 20] if weekend else [18, 20.5]):
        if rng.random() < (0.75 if weekend else 0.55):
            s = day.replace(hour=int(start_h), minute=int((start_h % 1) * 60))
            out.append((s, s + timedelta(minutes=rng.choice([60, 90, 120]))))
    return out


def generate(days: int, automation_from_day: int, seed: int = 7, end: datetime | None = None):
    """Yield (ts, hw, channel, current_a, power_w, energy_kwh) rows at 1-minute resolution.

    Before `automation_from_day` (counted from the start) rooms run lights and
    HVAC all day, as the building did before; after it, they follow bookings.
    """
    rng = random.Random(seed)
    end = (end or datetime.now(TZ)).replace(second=0, microsecond=0)
    start = (end - timedelta(days=days)).replace(hour=0, minute=0)
    machines = {(hw, ch): models.Machine(kind, rng=rng) for _, kind, hw, ch in catalog.LAUNDRY}
    rooms = {slug: models.Room(lights_w=r["lights_w"], hvac_comfort_w=r["hvac_w"]) for slug, r in catalog.ROOMS.items()}
    energy: dict[tuple[str, int], float] = {}
    sched: dict[str, list] = {}
    ev_sessions: dict[str, tuple[datetime, float]] = {}
    t = start
    while t < end:
        now = t.timestamp()
        if t.hour == 0 and t.minute == 0:
            sched = {slug: room_schedule(t, rng) for slug in rooms}
            # Some tenants plug in after dinner, wanting 15–40 kWh by morning.
            ev_sessions = {hw: (t.replace(hour=rng.randint(17, 21)), rng.uniform(15, 40))
                           for _, hw, _, fleet in catalog.CHARGERS if not fleet and rng.random() < 0.6}
        automated = (t - start).days >= automation_from_day
        rows: list[tuple[str, int, float]] = []
        for (hw, ch), m in machines.items():
            if rng.random() < models.laundry_arrival_rate(t.hour, t.weekday() >= 5) / 60:
                m.start(now)
            rows.append((hw, ch, m.power(now)))
        for slug, room in rooms.items():
            booked = any(s - timedelta(minutes=15) <= t < e + timedelta(minutes=10) for s, e in sched[slug])
            if automated:
                room.lights_on, room.hvac_mode = booked, "comfort" if booked else "setback"
            else:
                room.lights_on, room.hvac_mode = 9 <= t.hour < 23, "comfort"
            lights, hvac = room.power(now, rng)
            hw = catalog.ROOMS[slug]["ct"]
            rows += [(hw, 0, lights), (hw, 1, hvac)]
        rows.append(("sim-ct-lobby", 0, models.lobby_power(t.hour + t.minute / 60, rng)))
        for _, hw, kw, fleet in catalog.CHARGERS:
            w = 0.0
            if fleet:
                # Shuttle charges overnight after the last run.
                w = 7200.0 if (t.hour >= 22 or t.hour < 6) and rng.random() < 0.8 else 0.0
            elif hw in ev_sessions:
                begin, need = ev_sessions[hw]
                if t >= begin and need > 0:
                    # Before load management, cars charge at full power on arrival.
                    w = kw * 1000
                    need -= kw / 60
                    ev_sessions[hw] = (begin, need)
            rows.append((hw, 0, w))
        for hw, ch, w in rows:
            k = (hw, ch)
            energy[k] = energy.get(k, 0.0) + w / 1000 / 60
            yield t.astimezone(timezone.utc), hw, ch, w / 120, w, energy[k]
        t += timedelta(minutes=1)


def backfill(tsdb_dsn: str, app_dsn: str, days: int, automation_from_day: int | None = None) -> int:
    automation_from_day = days // 2 if automation_from_day is None else automation_from_day
    with psycopg.connect(app_dsn) as app:
        ids = _device_ids(app)
        if not ids:
            raise SystemExit("No simulated devices registered. Run `python -m marq_sim seed` first.")
        _backfill_runs(app, days)
    n = 0
    with psycopg.connect(tsdb_dsn) as ts:
        with ts.cursor() as cur:
            cur.execute("create temp table rb (like readings) on commit drop")
            with cur.copy("copy rb (ts, device_id, channel, current_a, power_w, energy_kwh) from stdin") as cp:
                for t, hw, ch, a, w, kwh in generate(days, automation_from_day):
                    if hw in ids:
                        cp.write_row((t, ids[hw], ch, round(a, 3), round(w, 1), kwh))
                        n += 1
            cur.execute("insert into readings select * from rb on conflict do nothing")
        ts.commit()
    log.info("backfilled %d readings over %d days (automation from day %d)", n, days, automation_from_day)
    return n


def _backfill_runs(app, days: int) -> None:
    """Completed shuttle runs with metrics for the timetable's past departures."""
    rng = random.Random(11)
    app.execute("""
        insert into public.runs (route_id, scheduled_run_id, service_date, scheduled_departure, status, started_at, ended_at)
        select s.route_id, s.id, d::date,
               ((d::date + s.departure_time)::timestamp at time zone 'America/Toronto'),
               'completed',
               ((d::date + s.departure_time)::timestamp at time zone 'America/Toronto') + interval '1 min',
               ((d::date + s.departure_time)::timestamp at time zone 'America/Toronto') + interval '29 min'
          from public.scheduled_runs s
          join generate_series(current_date - %s, current_date - 1, interval '1 day') d
            on extract(dow from d) = s.day_of_week
         where s.active
        on conflict (scheduled_run_id, service_date) do nothing""", (days,))
    runs = app.execute("""select r.id from public.runs r left join public.shuttle_run_metrics m on m.run_id = r.id
                          where r.status = 'completed' and m.run_id is null and r.service_date < current_date""").fetchall()
    with app.cursor() as cur:
        for (rid,) in runs:
            km = rng.gauss(6.4, 0.3)
            idle = max(60, rng.gauss(300, 90))
            cur.execute("""insert into public.shuttle_run_metrics (run_id, distance_km, duration, idle_time, stop_count, est_energy_kwh)
                           values (%s, %s, make_interval(secs => %s), make_interval(secs => %s), 5, %s)""",
                        (rid, round(km, 3), rng.gauss(28 * 60, 120), idle, round(km * 0.35 + idle / 3600 * 2, 3)))
    app.commit()
