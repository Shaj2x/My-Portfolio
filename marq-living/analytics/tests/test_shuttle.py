from datetime import datetime, time, timedelta

from marq_analytics.shuttle import Assumptions, analyse, blocks_for, charge_plan, run_stats
from marq_analytics.tariffs import TZ

METRICS = [{"distance_km": 6.4 + (i % 5) * 0.1, "duration_s": 1650 + (i % 7) * 30, "idle_s": 280 + (i % 3) * 30, "stop_count": 5} for i in range(60)]
HOURLY = {d: [time(h, 30) for h in range(7, 22)] for d in range(1, 6)}
HOURLY |= {0: [time(h) for h in range(10, 19, 2)], 6: [time(h) for h in range(10, 19, 2)]}


def test_stats_use_p90():
    s = run_stats(METRICS)
    assert s.runs == 60 and 6.7 <= s.distance_km_p90 <= 6.8 and s.stops_p90 == 5


def test_hourly_runs_are_separate_blocks_with_charge_windows():
    r = analyse(METRICS, HOURLY)
    assert r.worst_day in {"Mon", "Tue", "Wed", "Thu", "Fri"}
    assert len(r.blocks) == 15                      # 28-min runs, 30-min gaps → charge between each
    assert 2.3 < r.kwh_per_run < 3.0
    assert r.kwh_per_run_winter > r.kwh_per_run
    assert r.recommended_pack_kwh >= r.required_battery_kwh
    assert r.feasible and r.min_soc_pct >= 15
    assert r.daily_kwh_winter > 40


def test_back_to_back_runs_form_one_block_needing_bigger_pack():
    dense = {1: [time(7, 0) + timedelta(minutes=0) if False else time(7 + (m // 60), m % 60) for m in range(0, 600, 30)]}
    blocks = blocks_for(dense[1], 28, Assumptions())
    assert len(blocks) == 1
    r = analyse(METRICS, dense)
    assert r.hardest_block_kwh > 50 and r.recommended_pack_kwh >= 90


def test_few_runs_note():
    r = analyse(METRICS[:3], HOURLY)
    assert any("Only 3 runs" in n for n in r.notes)


def test_charge_plan_keeps_reserve():
    now = datetime(2026, 10, 7, 9, 0, tzinfo=TZ)
    deps = [now + timedelta(minutes=30 + 60 * i) for i in range(6)]
    plan = charge_plan(soc_pct=25, capacity_kwh=60, upcoming=deps, run_kwh=3.0, duration_min=28, now=now, charger_kw=19.2)
    assert plan, "25% can't cover six runs plus reserve"
    # Simulate: before each departure, apply charging that ended by then; SoC
    # must cover the run and still leave the 15% reserve.
    soc = 0.25 * 60
    applied = set()
    for d in deps:
        for i, sl in enumerate(plan):
            if i not in applied and datetime.fromisoformat(sl["end"]) <= d:
                soc += sl["kw"] * (datetime.fromisoformat(sl["end"]) - datetime.fromisoformat(sl["start"])).total_seconds() / 3600
                applied.add(i)
        assert soc - 3.0 >= 0.15 * 60 - 1e-6, (d, soc)
        soc -= 3.0
    assert all(sl["kw"] <= 19.2 for sl in plan)
    assert charge_plan(95, 60, deps, 3.0, 28, now, 19.2) == []
