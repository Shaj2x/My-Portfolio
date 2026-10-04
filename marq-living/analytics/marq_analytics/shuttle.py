"""What would an electric shuttle need for the current route and timetable?

Energy per run = distance × consumption (adjusted for cold) + idle time ×
cabin HVAC + a small per-stop cost for acceleration. The day is split into
"blocks" of back-to-back runs separated by gaps long enough to charge. The
battery must cover the hardest block (plus a reserve, within the usable
depth of discharge, with a design margin); chargers must refill each gap in
time for the next block. A state-of-charge simulation over the worst day
checks the recommendation.
"""
from __future__ import annotations

import math
import statistics
from dataclasses import asdict, dataclass, field
from datetime import datetime, time, timedelta

STANDARD_PACKS = [35, 50, 60, 75, 90, 105, 120, 150]  # kWh, typical e-van / small bus options


@dataclass
class Assumptions:
    kwh_per_km: float = 0.32          # 12-passenger e-van, mild weather
    hvac_kw: float = 2.5              # cabin heat/cool while idling
    stop_kwh: float = 0.03            # per stop (accelerate back to speed)
    winter_factor: float = 1.35       # −10 °C: battery + cabin heat
    usable_dod: float = 0.85          # use 85% of nameplate
    reserve_pct: float = 0.15         # never plan below 15% SoC
    margin: float = 0.15              # design margin on top
    charger_kw: float = 19.2          # Level 2 at 80 A; 50 for DC fast
    min_gap_min: int = 20             # gap long enough to plug in and charge
    turnaround_min: int = 2


@dataclass
class RunStats:
    runs: int
    distance_km_p50: float
    distance_km_p90: float
    duration_min_p90: float
    idle_min_p90: float
    stops_p90: float


@dataclass
class Report:
    stats: RunStats
    assumptions: Assumptions
    kwh_per_run: float
    kwh_per_run_winter: float
    runs_per_day: dict
    daily_kwh_winter: float
    worst_day: str
    blocks: list[dict]
    hardest_block_kwh: float
    required_battery_kwh: float
    recommended_pack_kwh: int
    charge_windows: list[dict]
    min_soc_pct: float
    feasible: bool
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        d = asdict(self)
        return d


def pct(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    v = sorted(values)
    k = (len(v) - 1) * p
    lo, hi = math.floor(k), math.ceil(k)
    return v[lo] + (v[hi] - v[lo]) * (k - lo)


def run_stats(metrics: list[dict]) -> RunStats:
    d = [float(m["distance_km"]) for m in metrics]
    dur = [m["duration_s"] / 60 for m in metrics]
    idle = [m["idle_s"] / 60 for m in metrics]
    stops = [float(m["stop_count"]) for m in metrics]
    return RunStats(len(metrics), round(pct(d, 0.5), 2), round(pct(d, 0.9), 2), round(pct(dur, 0.9), 1), round(pct(idle, 0.9), 1), round(pct(stops, 0.9), 1))


def energy_per_run(s: RunStats, a: Assumptions, winter: bool = False) -> float:
    e = s.distance_km_p90 * a.kwh_per_km + s.idle_min_p90 / 60 * a.hvac_kw + s.stops_p90 * a.stop_kwh
    return e * (a.winter_factor if winter else 1.0)


def blocks_for(departures: list[time], duration_min: float, a: Assumptions) -> list[list[time]]:
    """Group a day's departures into blocks separated by charge-able gaps."""
    out: list[list[time]] = []
    prev_end = None
    for t in sorted(departures):
        start = datetime.combine(datetime.min, t)
        if prev_end is None or (start - prev_end) >= timedelta(minutes=a.min_gap_min):
            out.append([t])
        else:
            out[-1].append(t)
        prev_end = start + timedelta(minutes=duration_min + a.turnaround_min)
    return out


def analyse(metrics: list[dict], timetable: dict[int, list[time]], a: Assumptions | None = None) -> Report:
    """timetable: weekday (0=Sun..6=Sat, like Postgres dow) → departure times."""
    a = a or Assumptions()
    notes = []
    if len(metrics) < 10:
        notes.append(f"Only {len(metrics)} runs logged; using defaults where needed. Accuracy improves after two weeks of runs.")
        metrics = metrics or [{"distance_km": 6.5, "duration_s": 1680, "idle_s": 300, "stop_count": 5}]
    st = run_stats(metrics)
    e, ew = energy_per_run(st, a), energy_per_run(st, a, winter=True)
    names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    per_day = {names[d]: len(ts) for d, ts in sorted(timetable.items())}
    worst_dow = max(timetable, key=lambda d: (max((len(b) for b in blocks_for(timetable[d], st.duration_min_p90, a)), default=0), len(timetable[d])), default=1)
    day = sorted(timetable.get(worst_dow, []))
    blocks = blocks_for(day, st.duration_min_p90, a)
    block_kwh = [len(b) * ew for b in blocks]
    hardest = max(block_kwh, default=0.0)

    # Battery: hardest block must fit between full and reserve, within usable DoD.
    need = hardest / (a.usable_dod - a.reserve_pct) * (1 + a.margin) if hardest else 0.0
    pack = next((p for p in STANDARD_PACKS if p >= need), STANDARD_PACKS[-1])
    if need > STANDARD_PACKS[-1]:
        notes.append("Hardest block exceeds common pack sizes: add a mid-day DC fast charge or split the block.")

    # Charge windows between blocks and a SoC simulation over the worst winter day.
    windows, soc = [], 100.0
    min_soc = 100.0
    usable = pack * a.usable_dod
    for i, b in enumerate(blocks):
        soc -= block_kwh[i] / usable * 100 * a.usable_dod
        min_soc = min(min_soc, soc)
        if i + 1 < len(blocks):
            end = datetime.combine(datetime.min, b[-1]) + timedelta(minutes=st.duration_min_p90 + a.turnaround_min)
            nxt = datetime.combine(datetime.min, blocks[i + 1][0])
            gap_h = max((nxt - end).total_seconds() / 3600 - 5 / 60, 0)  # 5 min to plug in
            add = min(a.charger_kw * gap_h, pack * (100 - soc) / 100)
            windows.append({"from": end.time().strftime("%H:%M"), "to": nxt.time().strftime("%H:%M"), "hours": round(gap_h, 2),
                            "kwh_possible": round(a.charger_kw * gap_h, 1), "kwh_needed_for_next_block": round(block_kwh[i + 1], 1)})
            soc += add / pack * 100
    overnight = {"from": "after last run", "to": "first run", "kwh_needed": round(sum(block_kwh), 1)}
    windows.append(overnight)
    feasible = min_soc >= a.reserve_pct * 100 - 1e-6
    if not feasible:
        notes.append("Even a full pack dips below reserve on the worst day: use a faster charger or a larger pack.")
    return Report(st, a, round(e, 2), round(ew, 2), per_day, round(len(day) * ew, 1), names[worst_dow],
                  [{"departures": [t.strftime("%H:%M") for t in b], "kwh_winter": round(len(b) * ew, 1)} for b in blocks],
                  round(hardest, 1), round(need, 1), pack, windows, round(min_soc, 1), feasible, notes)


def charge_plan(soc_pct: float, capacity_kwh: float, upcoming: list[datetime], run_kwh: float, duration_min: float,
                now: datetime, charger_kw: float, reserve_pct: float = 15.0, a: Assumptions | None = None) -> list[dict]:
    """For an electric shuttle: charging windows in the gaps between today's
    remaining runs so it always starts each block with enough for that block
    plus reserve. Returns [{"start","end","kw"}] (charger power limits)."""
    a = a or Assumptions()
    slots = []
    soc_kwh = soc_pct / 100 * capacity_kwh
    reserve = reserve_pct / 100 * capacity_kwh
    t = now
    deps = sorted(d for d in upcoming if d > now)
    # Blocks of back-to-back runs.
    groups: list[list[datetime]] = []
    for d in deps:
        if groups and (d - (groups[-1][-1] + timedelta(minutes=duration_min + a.turnaround_min))) < timedelta(minutes=a.min_gap_min):
            groups[-1].append(d)
        else:
            groups.append([d])
    for g in groups:
        need = len(g) * run_kwh + reserve
        gap_h = max((g[0] - t).total_seconds() / 3600, 0)
        if soc_kwh < need and gap_h > 0:
            add = min(need - soc_kwh + 0.1 * capacity_kwh, charger_kw * gap_h, capacity_kwh - soc_kwh)
            kw = add / gap_h
            slots.append({"start": t.isoformat(), "end": g[0].isoformat(), "kw": round(min(kw, charger_kw), 2)})
            soc_kwh += add
        soc_kwh -= len(g) * run_kwh
        t = g[-1] + timedelta(minutes=duration_min + a.turnaround_min)
    return slots
