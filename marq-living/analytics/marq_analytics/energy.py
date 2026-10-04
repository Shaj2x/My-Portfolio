"""Energy reporting: live load, per-system series, cost by price period,
peak demand, carbon, and automation savings."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from . import db
from .tariffs import Tariff

BUCKET_H = 0.25  # 15-minute demand interval


def live(tsdb_url: str, app_url: str) -> dict:
    chans = db.channels(app_url)
    with db.connect(tsdb_url) as c:
        rows = c.execute("select device_id::text as device_id, channel, ts, current_a, power_w from readings_latest").fetchall()
    items, by_system = [], defaultdict(float)
    for r in rows:
        ch = chans.get((r["device_id"], r["channel"]))
        if not ch:
            continue
        kw = (r["power_w"] or 0) / 1000
        by_system[ch.system] += kw
        items.append({"device_id": ch.device_id, "channel": ch.channel, "device": ch.device, "label": ch.label,
                      "system": ch.system, "kw": round(kw, 3), "current_a": round(r["current_a"] or 0, 2), "ts": r["ts"].isoformat()})
    total = sum(by_system.values())
    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "total_kw": round(total, 2),
        "peak_limit_kw": db.peak_limit_kw(app_url),
        "systems": [{"system": s, "name": db.SYSTEMS[s], "kw": round(v, 2)} for s, v in sorted(by_system.items(), key=lambda x: -x[1])],
        "channels": sorted(items, key=lambda x: -x["kw"]),
    }


def _buckets(tsdb_url: str, start: datetime, end: datetime) -> list[dict]:
    with db.connect(tsdb_url) as c:
        return c.execute("""select bucket, device_id::text as device_id, channel, avg_power_w
                              from readings_15m where bucket >= %s and bucket < %s order by bucket""", (start, end)).fetchall()


def series(tsdb_url: str, app_url: str, start: datetime, end: datetime) -> dict:
    """Average kW per system for each 15-minute interval."""
    chans = db.channels(app_url)
    grid: dict[datetime, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for r in _buckets(tsdb_url, start, end):
        ch = chans.get((r["device_id"], r["channel"]))
        grid[r["bucket"]][ch.system if ch else "other"] += (r["avg_power_w"] or 0) / 1000
    systems = sorted({s for row in grid.values() for s in row})
    return {
        "systems": [{"system": s, "name": db.SYSTEMS[s]} for s in systems],
        "points": [{"t": t.isoformat(), **{s: round(v.get(s, 0.0), 3) for s in systems}, "total": round(sum(v.values()), 3)}
                   for t, v in sorted(grid.items())],
    }


def summary(tsdb_url: str, app_url: str, start: datetime, end: datetime, tariff: Tariff) -> dict:
    """kWh, cost and carbon by system and by price period; 15-minute peak demand."""
    chans = db.channels(app_url)
    kwh_sys: dict[str, float] = defaultdict(float)
    cost_sys: dict[str, float] = defaultdict(float)
    kwh_period: dict[str, float] = defaultdict(float)
    cost_period: dict[str, float] = defaultdict(float)
    demand: dict[datetime, float] = defaultdict(float)
    for r in _buckets(tsdb_url, start, end):
        ch = chans.get((r["device_id"], r["channel"]))
        system = ch.system if ch else "other"
        kw = (r["avg_power_w"] or 0) / 1000
        kwh = kw * BUCKET_H
        price = tariff.price_per_kwh(r["bucket"])
        period = tariff.period(r["bucket"])
        kwh_sys[system] += kwh
        cost_sys[system] += kwh * price
        kwh_period[period] += kwh
        cost_period[period] += kwh * price
        demand[r["bucket"]] += kw
    total_kwh = sum(kwh_sys.values())
    peak_t, peak_kw = max(demand.items(), key=lambda x: x[1]) if demand else (None, 0.0)
    return {
        "from": start.isoformat(), "to": end.isoformat(), "plan": tariff.plan,
        "total_kwh": round(total_kwh, 2),
        "total_cost": round(sum(cost_sys.values()), 2),
        "carbon_kg": round(total_kwh * tariff.carbon_kg_per_kwh, 1),
        "peak_kw": round(peak_kw, 2),
        "peak_at": peak_t.isoformat() if peak_t else None,
        "by_system": [{"system": s, "name": db.SYSTEMS[s], "kwh": round(kwh_sys[s], 2), "cost": round(cost_sys[s], 2)}
                      for s in sorted(kwh_sys, key=lambda s: -kwh_sys[s])],
        "by_period": [{"period": p, "kwh": round(kwh_period[p], 2), "cost": round(cost_period[p], 2),
                       "cents_per_kwh": (tariff.ulo if tariff.plan == "ulo" else tariff.tou)[p]} for p in sorted(kwh_period)],
    }


def room_savings(tsdb_url: str, app_url: str, start: datetime, end: datetime, tariff: Tariff) -> dict:
    """Automated rooms vs. the old always-on baseline (room.baseline_kw × hours)."""
    chans = db.channels(app_url)
    with db.connect(app_url) as c:
        rooms = c.execute("select slug, name, baseline_kw from public.rooms where baseline_kw is not null").fetchall()
    actual: dict[str, float] = defaultdict(float)
    for r in _buckets(tsdb_url, start, end):
        ch = chans.get((r["device_id"], r["channel"]))
        if ch and ch.room_slug:
            actual[ch.room_slug] += (r["avg_power_w"] or 0) / 1000 * BUCKET_H
    hours = (end - start).total_seconds() / 3600
    avg_price = sum(tariff.price_per_kwh(start + timedelta(hours=h)) for h in range(int(hours) or 1)) / (int(hours) or 1)
    out = []
    for room in rooms:
        baseline = float(room["baseline_kw"]) * hours
        used = actual.get(room["slug"], 0.0)
        saved = max(baseline - used, 0.0)
        out.append({"room": room["slug"], "name": room["name"], "baseline_kwh": round(baseline, 1), "actual_kwh": round(used, 1),
                    "saved_kwh": round(saved, 1), "saved_cost": round(saved * avg_price, 2),
                    "saved_pct": round(100 * saved / baseline, 1) if baseline else 0.0})
    return {"from": start.isoformat(), "to": end.isoformat(), "rooms": out,
            "total_saved_kwh": round(sum(r["saved_kwh"] for r in out), 1),
            "total_saved_cost": round(sum(r["saved_cost"] for r in out), 2),
            "carbon_avoided_kg": round(sum(r["saved_kwh"] for r in out) * tariff.carbon_kg_per_kwh, 1)}
