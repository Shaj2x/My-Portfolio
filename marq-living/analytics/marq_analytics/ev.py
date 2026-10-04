"""EV charge scheduling under a building peak-demand limit.

Each session wants `need_kwh` by `departure`. Time is split into 15-minute
intervals; each interval has headroom = peak limit − forecast base load
(plus any battery/solar). Sessions are planned earliest-departure-first;
each takes the cheapest intervals (ULO overnight first) before it leaves,
up to its charger's rating and the interval's remaining headroom. If a
session can't be met in time it gets everything available and is flagged
with its shortfall, so staff can see it.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from .sources import Sources
from .tariffs import Tariff

STEP = timedelta(minutes=15)
STEP_H = 0.25


@dataclass
class Session:
    id: str
    need_kwh: float
    departure: datetime
    max_kw: float
    # Minimum useful rate; below this, chargers/vehicles may not start.
    min_kw: float = 1.4


@dataclass
class Plan:
    session_id: str
    slots: list[dict] = field(default_factory=list)  # {"start", "end", "kw"}
    planned_kwh: float = 0.0
    shortfall_kwh: float = 0.0
    est_complete_at: datetime | None = None


def floor_step(t: datetime) -> datetime:
    t = t.astimezone(timezone.utc).replace(second=0, microsecond=0)
    return t - timedelta(minutes=t.minute % 15)


def schedule(sessions: list[Session], now: datetime, base_kw: list[float], sources: Sources, tariff: Tariff) -> tuple[list[Plan], list[float]]:
    """Returns plans and the resulting EV load per interval (kW).

    base_kw[i] is the forecast non-EV load for interval i starting at
    floor_step(now) + i × 15 min. Intervals beyond the forecast reuse the
    same time yesterday, or the last value.
    """
    if not sessions:
        return [], []
    t0 = floor_step(now)
    horizon = max(s.departure for s in sessions)
    n = max(1, math.ceil((horizon - t0) / STEP))
    base = [base_kw[i] if i < len(base_kw) else (base_kw[i - 96] if i >= 96 and i - 96 < len(base_kw) else (base_kw[-1] if base_kw else 0.0)) for i in range(n)]
    starts = [t0 + i * STEP for i in range(n)]
    price = [tariff.price_per_kwh(t) for t in starts]
    headroom = [sources.headroom(i, base[i], STEP_H) for i in range(n)]
    # The current interval is partly gone.
    first_frac = 1 - (now - t0) / STEP
    ev = [0.0] * n
    plans = []

    for s in sorted(sessions, key=lambda s: (s.departure, -s.need_kwh)):
        plan = Plan(session_id=s.id)
        need = max(s.need_kwh, 0.0)
        last = min(n, math.floor((s.departure - t0) / STEP))
        # Cheapest first, earlier first among equals.
        order = sorted(range(last), key=lambda i: (price[i], i))
        alloc: dict[int, float] = {}
        for i in order:
            if need <= 1e-6:
                break
            frac = first_frac if i == 0 else 1.0
            kw = min(s.max_kw, headroom[i] - ev[i])
            if kw < s.min_kw:
                continue
            kwh = min(kw * STEP_H * frac, need)
            kw_used = kwh / (STEP_H * frac)
            alloc[i] = kw_used
            ev[i] += kw_used
            need -= kwh
        for i in sorted(alloc):
            plan.slots.append({"start": starts[i].isoformat(), "end": (starts[i] + STEP).isoformat(), "kw": round(alloc[i], 2)})
        plan.planned_kwh = round(s.need_kwh - need, 3)
        plan.shortfall_kwh = round(need, 3)
        if alloc:
            plan.est_complete_at = starts[max(alloc)] + STEP
        plans.append(plan)
    return plans, ev


def current_kw(plan_slots: list[dict], now: datetime) -> float:
    for s in plan_slots:
        if datetime.fromisoformat(s["start"]) <= now < datetime.fromisoformat(s["end"]):
            return float(s["kw"])
    return 0.0


def cost(plan: Plan, tariff: Tariff) -> float:
    return sum(s["kw"] * STEP_H * tariff.price_per_kwh(datetime.fromisoformat(s["start"])) for s in plan.slots)


def unmanaged_cost(sess: Session, arrive: datetime, tariff: Tariff) -> float:
    """What the same charge costs if it starts at full power on arrival."""
    need, t, c = sess.need_kwh, arrive, 0.0
    while need > 1e-6:
        kwh = min(sess.max_kw * STEP_H, need)
        c += kwh * tariff.price_per_kwh(t)
        need -= kwh
        t += STEP
    return c
