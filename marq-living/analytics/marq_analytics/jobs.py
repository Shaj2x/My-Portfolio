"""Scheduled jobs: forecast, actuals, EV planning, shuttle charging, anomalies."""
from __future__ import annotations

import json
import logging
from datetime import datetime, time, timedelta, timezone

import numpy as np
import pandas as pd

from . import db, ev, forecast, shuttle
from .config import Settings, tariff
from .sources import Battery, Grid, Solar, Sources
from .tariffs import TZ
from .weather import hourly_temps

log = logging.getLogger(__name__)


def _ev_devices(app_url: str) -> list[str]:
    with db.connect(app_url) as c:
        return [r["id"] for r in c.execute("select id::text as id from public.devices where type = 'ev_charger'").fetchall()]


def base_load_history(s: Settings, days: int) -> pd.Series:
    """Non-EV load (kW) per 15 minutes: what the forecast predicts and EV charging fits around."""
    ev_ids = _ev_devices(s.app_url)
    since = datetime.now(timezone.utc) - timedelta(days=days)
    with db.connect(s.tsdb_url) as c:
        rows = c.execute("""select bucket, sum(avg_power_w) / 1000 as kw from readings_15m
                             where bucket >= %s and not (device_id = any(%s::uuid[])) group by bucket order by bucket""",
                         (since, ev_ids)).fetchall()
    if not rows:
        return pd.Series(dtype=float)
    return pd.Series([float(r["kw"]) for r in rows], index=pd.DatetimeIndex([r["bucket"] for r in rows]).tz_convert(timezone.utc))


def _interval_counts(s: Settings, start: datetime, end: datetime) -> tuple[pd.Series, pd.Series]:
    idx = pd.date_range(start, end, freq="15min", tz=timezone.utc)
    bookings = pd.Series(0.0, index=idx)
    shuttle_s = pd.Series(0.0, index=idx)
    with db.connect(s.app_url) as c:
        for r in c.execute("select lower(period) as s, upper(period) as e from public.bookings where status in ('confirmed','completed') and period && tstzrange(%s, %s)", (start, end)):
            bookings[(idx >= pd.Timestamp(r["s"]).floor("15min")) & (idx < pd.Timestamp(r["e"]))] += 1
        for r in c.execute("select scheduled_departure as t from public.runs where status <> 'cancelled' and scheduled_departure between %s and %s", (start, end)):
            shuttle_s[pd.Timestamp(r["t"]).floor("15min")] = shuttle_s.get(pd.Timestamp(r["t"]).floor("15min"), 0) + 1
    return bookings, shuttle_s


def run_forecast(s: Settings, day: datetime | None = None) -> dict:
    """Forecast the next local day (or `day`) and store it."""
    if day is None:
        tomorrow = (datetime.now(TZ) + timedelta(days=1)).date()
        day = datetime.combine(tomorrow, time(0), TZ)
    day_utc = day.astimezone(timezone.utc)
    load = base_load_history(s, 56)
    start = (load.index.min().to_pydatetime() if len(load) else day_utc - timedelta(days=1))
    temps = hourly_temps(s.weather_url, s.lat, s.lng, start, day_utc + timedelta(days=1))
    bookings, shuttle_s = _interval_counts(s, start, day_utc + timedelta(days=1))
    res = forecast.forecast(load, temps, bookings, shuttle_s, day_utc)
    generated = datetime.now(timezone.utc)
    with db.connect(s.app_url) as c:
        with c.cursor() as cur:
            cur.executemany("""insert into public.forecasts (timestamp, predicted_kw, lower_kw, upper_kw, model, generated_at)
                               values (%s, %s, %s, %s, %s, %s)""",
                            [(p["t"], p["predicted_kw"], p["lower_kw"], p["upper_kw"], res.model, generated) for p in res.points])
    log.info("forecast %s: %s, %d intervals, holdout MAPE %s", day.date(), res.model, len(res.points), res.mape)
    return {"day": day.date().isoformat(), "model": res.model, "mape": res.mape, "trained_on": res.trained_on, "points": res.points}


def update_actuals(s: Settings) -> int:
    load = base_load_history(s, 3)
    if load.empty:
        return 0
    with db.connect(s.app_url) as c:
        with c.cursor() as cur:
            cur.executemany("update public.forecasts set actual_kw = %s where timestamp = %s and actual_kw is null",
                            [(round(float(v), 2), t.to_pydatetime()) for t, v in load.items() if t < pd.Timestamp.now(tz=timezone.utc) - pd.Timedelta(minutes=15)])
            return cur.rowcount


def latest_forecast(s: Settings, start: datetime, end: datetime) -> list[dict]:
    with db.connect(s.app_url) as c:
        return c.execute("""select distinct on (timestamp) timestamp, predicted_kw, lower_kw, upper_kw, actual_kw, model
                              from public.forecasts where timestamp >= %s and timestamp < %s
                             order by timestamp, generated_at desc""", (start, end)).fetchall()


def base_profile(s: Settings, start: datetime, n: int) -> list[float]:
    """Forecast base load for n intervals from start: stored forecast, else recent same-time average."""
    fc = {r["timestamp"]: float(r["upper_kw"] or r["predicted_kw"]) for r in latest_forecast(s, start, start + n * ev.STEP)}
    hist = base_load_history(s, 14)
    naive = forecast.seasonal_naive(hist, pd.date_range(start, periods=n, freq="15min", tz=timezone.utc)) if len(hist) else np.zeros(n)
    return [fc.get(start + i * ev.STEP, float(naive[i])) for i in range(n)]


def _sources(s: Settings, n: int) -> Sources:
    with db.connect(s.app_url) as c:
        rows = c.execute("select kind::text as kind, max_import_kw, max_export_kw, capacity_kwh, peak_limit_kw from public.energy_sources where enabled").fetchall()
    grid = next((r for r in rows if r["kind"] == "grid"), None)
    src = Sources(Grid(float(grid["peak_limit_kw"]) if grid and grid["peak_limit_kw"] else 150.0))
    for r in rows:
        if r["kind"] == "battery" and r["capacity_kwh"]:
            # Plan conservatively with the battery half full until SoC telemetry is wired in.
            src.battery = Battery(float(r["capacity_kwh"]), float(r["max_export_kw"] or 0), float(r["capacity_kwh"]) / 2, float(r["capacity_kwh"]) * 0.2)
        if r["kind"] == "solar" and r["max_export_kw"]:
            src.solar = Solar([0.0] * n)  # placeholder until a PV forecast is connected
    return src


def schedule_ev(s: Settings) -> dict:
    """Assign chargers, plan every active EV session (and the shuttle) under the peak limit."""
    now = datetime.now(timezone.utc)
    t = tariff(s)
    with db.connect(s.app_url) as c:
        sessions = c.execute("""select s.id::text as id, s.tenant_id::text as tenant_id, s.charger_id::text as charger_id, s.status::text as status,
                                       greatest(s.requested_kwh - s.delivered_kwh, 0) as need, s.departure_time, s.plan,
                                       coalesce(ch.max_kw, 7.2) as max_kw
                                  from public.ev_sessions s left join public.ev_chargers ch on ch.id = s.charger_id
                                 where s.status in ('requested', 'scheduled', 'charging', 'paused') and s.departure_time > now()
                                 order by s.created_at""").fetchall()
        chargers = c.execute("select id::text as id, max_kw, fleet_only from public.ev_chargers where status <> 'retired'").fetchall()
        busy = {r["charger_id"] for r in sessions if r["charger_id"]}
        free = [ch for ch in chargers if not ch["fleet_only"] and ch["id"] not in busy]
        for r in sessions:
            if not r["charger_id"] and r["tenant_id"] and free:
                ch = free.pop(0)
                r["charger_id"], r["max_kw"] = ch["id"], ch["max_kw"]
                c.execute("update public.ev_sessions set charger_id = %s where id = %s", (ch["id"], r["id"]))

    plannable = [r for r in sessions if r["charger_id"]]
    horizon = max([r["departure_time"] for r in plannable], default=now + timedelta(hours=1))
    n = int((horizon - ev.floor_step(now)) / ev.STEP) + 1
    base = base_profile(s, ev.floor_step(now), n)
    sources = _sources(s, n)
    plans, ev_kw = ev.schedule([ev.Session(r["id"], float(r["need"]), r["departure_time"], float(r["max_kw"])) for r in plannable], now, base, sources, t)
    by_id = {p.session_id: p for p in plans}
    newly = []
    with db.connect(s.app_url) as c:
        for r in plannable:
            p = by_id[r["id"]]
            status = "scheduled" if r["status"] == "requested" else r["status"]
            c.execute("update public.ev_sessions set plan = %s, est_complete_at = %s, status = %s::public.ev_session_status where id = %s",
                      (json.dumps({"slots": p.slots, "planned_kwh": p.planned_kwh, "shortfall_kwh": p.shortfall_kwh, "planned_at": now.isoformat()}), p.est_complete_at, status, r["id"]))
            if r["status"] == "requested" and r["tenant_id"]:
                newly.append((r["tenant_id"], p))
        for tenant, p in newly:
            when = p.est_complete_at.astimezone(TZ).strftime("%-I:%M %p %a") if p.est_complete_at else "—"
            body = f"Ready by {when}." + (f" About {p.shortfall_kwh:.0f} kWh short of your request by departure." if p.shortfall_kwh > 0.5 else " Charging is scheduled for the cheapest overnight hours.")
            c.execute("select public.notify_users(array[%s]::uuid[], 'ev_update', 'EV charging scheduled', %s, '/ev', false, true, false, '{}'::jsonb)", (tenant, body))
    shuttle_res = plan_shuttle_charging(s)
    peak = max((b + e for b, e in zip(base, ev_kw)), default=0.0)
    return {"sessions": len(plannable), "unassigned": len(sessions) - len(plannable), "peak_kw": round(peak, 2),
            "limit_kw": sources.grid.peak_limit_kw, "shuttle": shuttle_res,
            "plans": [{"session_id": p.session_id, "planned_kwh": p.planned_kwh, "shortfall_kwh": p.shortfall_kwh,
                       "est_complete_at": p.est_complete_at.isoformat() if p.est_complete_at else None, "slots": p.slots} for p in plans]}


def plan_shuttle_charging(s: Settings, capacity_kwh: float = 60.0) -> dict | None:
    """If the shuttle reports state of charge, plan its charger around today's runs."""
    with db.connect(s.app_url) as c:
        tele = c.execute("select id::text as id from public.devices where type = 'shuttle_telematics' and status <> 'retired' limit 1").fetchone()
        charger = c.execute("select id::text as id, max_kw from public.ev_chargers where fleet_only limit 1").fetchone()
        if not tele or not charger:
            return None
        deps = [r["t"] for r in c.execute("""select scheduled_departure + make_interval(mins => coalesce(delay_minutes, 0)) as t from public.runs
                                              where status = 'scheduled' and scheduled_departure > now() and scheduled_departure < now() + interval '18 hours'
                                              order by 1""").fetchall()]
        stats = c.execute("""select coalesce(percentile_cont(0.9) within group (order by est_energy_kwh), 3.0) as kwh,
                                    coalesce(percentile_cont(0.9) within group (order by extract(epoch from duration) / 60), 28) as mins
                               from public.shuttle_run_metrics where created_at > now() - interval '30 days'""").fetchone()
    with db.connect(s.tsdb_url) as c:
        soc = c.execute("select value from metrics where device_id = %s and name = 'soc_pct' order by ts desc limit 1", (tele["id"],)).fetchone()
    if not soc or not deps:
        return None
    now = datetime.now(timezone.utc)
    slots = shuttle.charge_plan(float(soc["value"]), capacity_kwh, deps, float(stats["kwh"]), float(stats["mins"]), now, float(charger["max_kw"]))
    with db.connect(s.app_url) as c:
        c.execute("delete from public.ev_sessions where charger_id = %s and tenant_id is null and status in ('scheduled', 'charging', 'paused')", (charger["id"],))
        if slots:
            need = sum(sl["kw"] * (datetime.fromisoformat(sl["end"]) - datetime.fromisoformat(sl["start"])).total_seconds() / 3600 for sl in slots)
            c.execute("""insert into public.ev_sessions (charger_id, vehicle_label, requested_kwh, departure_time, status, plan, est_complete_at)
                         values (%s, 'Shuttle', %s, %s, 'scheduled', %s, %s)""",
                      (charger["id"], max(round(need, 2), 0.1), deps[-1], json.dumps({"slots": slots, "shortfall_kwh": 0}), slots[-1]["end"]))
    return {"soc_pct": float(soc["value"]), "windows": slots}


def electrification(s: Settings, a: shuttle.Assumptions | None = None) -> dict:
    with db.connect(s.app_url) as c:
        metrics = c.execute("""select distance_km, extract(epoch from duration) as duration_s, extract(epoch from idle_time) as idle_s, stop_count
                                 from public.shuttle_run_metrics where created_at > now() - interval '60 days'""").fetchall()
        sched = c.execute("select day_of_week, departure_time from public.scheduled_runs s join public.routes r on r.id = s.route_id where s.active and r.active").fetchall()
    timetable: dict[int, list[time]] = {}
    for r in sched:
        timetable.setdefault(int(r["day_of_week"]), []).append(r["departure_time"])
    return shuttle.analyse([{k: float(v) for k, v in m.items()} for m in metrics], timetable, a).to_dict()


def detect_anomalies(s: Settings, k: float = 4.0, min_w: float = 200.0) -> list[dict]:
    """Flag channels whose last hour is far above their usual for that hour of the week."""
    chans = db.channels(s.app_url)
    since = datetime.now(timezone.utc) - timedelta(days=28)
    with db.connect(s.tsdb_url) as c:
        rows = c.execute("""select device_id::text as device_id, channel, time_bucket('1 hour', bucket) as hour, avg(avg_power_w) as w
                              from readings_15m where bucket >= %s group by 1, 2, 3""", (since,)).fetchall()
    if not rows:
        return []
    df = pd.DataFrame(rows)
    df["hour"] = pd.to_datetime(df["hour"], utc=True)
    # Judge the last complete hour.
    last_hour = pd.Timestamp(datetime.now(timezone.utc)).floor("h") - pd.Timedelta(hours=1)
    df["how"] = df["hour"].dt.tz_convert(TZ).dt.dayofweek * 24 + df["hour"].dt.tz_convert(TZ).dt.hour
    found = []
    for (dev, ch), g in df.groupby(["device_id", "channel"]):
        cur = g[g["hour"] == last_hour]
        if cur.empty:
            continue
        before = g[g["hour"] < last_hour]
        hist = before[before["how"] == cur["how"].iloc[0]]["w"]
        if len(hist) < 3:
            # Under three weeks of history: same hour of day on any day.
            hist = before[before["how"] % 24 == cur["how"].iloc[0] % 24]["w"]
        if len(hist) < 3:
            continue
        med = float(hist.median())
        mad = float((hist - med).abs().median()) * 1.4826
        x = float(cur["w"].iloc[0])
        if x - med > max(k * mad, min_w):
            meta = chans.get((dev, int(ch)))
            label = meta.label if meta else f"channel {ch}"
            found.append({"device_id": dev, "channel": int(ch), "power_w": round(x), "usual_w": round(med),
                          "message": f"{label} averaged {x:.0f} W in the last hour; usually {med:.0f} W at this time"})
    if found:
        with db.connect(s.app_url) as c:
            for f in found:
                recent = c.execute("""select 1 from public.device_events where device_id = %s and type = 'anomaly'
                                        and (payload->>'channel')::int = %s and occurred_at > now() - interval '6 hours'""", (f["device_id"], f["channel"])).fetchone()
                if not recent:
                    c.execute("insert into public.device_events (device_id, type, payload) values (%s, 'anomaly', %s)",
                              (f["device_id"], json.dumps({**f, "source": "analytics"})))
    return found
