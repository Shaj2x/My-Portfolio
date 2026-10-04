from datetime import datetime, timedelta

from marq_analytics.ev import STEP_H, Session, cost, floor_step, schedule, unmanaged_cost
from marq_analytics.sources import Battery, Grid, Sources
from marq_analytics.tariffs import TZ, Tariff

NOW = datetime(2026, 10, 7, 18, 0, tzinfo=TZ)  # Wednesday 6 pm (ULO on-peak)
ULO = Tariff(plan="ulo")


def flat(kw, n=200):
    return [kw] * n


def test_charges_in_ultra_low_window_and_meets_departure():
    s = Session("a", need_kwh=30, departure=NOW + timedelta(hours=14), max_kw=7.2)  # leaves 8 am
    plans, ev = schedule([s], NOW, flat(40), Sources(Grid(150)), ULO)
    p = plans[0]
    assert p.shortfall_kwh == 0 and abs(p.planned_kwh - 30) < 1e-6
    for slot in p.slots:
        assert ULO.period(datetime.fromisoformat(slot["start"])) == "ultra_low", slot
    assert p.est_complete_at <= s.departure
    assert cost(p, ULO) < 0.5 * unmanaged_cost(s, NOW, ULO)


def test_never_exceeds_peak_limit():
    base = [90 + (i % 96) * 0.4 for i in range(200)]  # 90–128 kW
    sessions = [Session(str(i), need_kwh=25, departure=NOW + timedelta(hours=13), max_kw=7.2) for i in range(6)]
    plans, ev = schedule(sessions, NOW, base, Sources(Grid(130)), ULO)
    for i, kw in enumerate(ev):
        assert base[i] + kw <= 130 + 1e-6, (i, base[i], kw)
    for p in plans:
        for slot in p.slots:
            assert slot["kw"] <= 7.2 + 1e-9


def test_earliest_departure_gets_priority_when_constrained():
    # Only ~4 kW of headroom: two cars can't both finish.
    early = Session("early", need_kwh=10, departure=NOW + timedelta(hours=3), max_kw=7.2)
    late = Session("late", need_kwh=10, departure=NOW + timedelta(hours=3, minutes=30), max_kw=7.2)
    plans, _ = schedule([late, early], NOW, flat(146), Sources(Grid(150)), ULO)
    by = {p.session_id: p for p in plans}
    assert by["early"].shortfall_kwh == 0
    assert by["late"].shortfall_kwh > 0


def test_short_notice_charges_now_even_if_expensive():
    s = Session("x", need_kwh=7, departure=NOW + timedelta(hours=2), max_kw=7.2)
    plans, _ = schedule([s], NOW, flat(40), Sources(Grid(150)), ULO)
    assert plans[0].shortfall_kwh == 0
    assert all(ULO.period(datetime.fromisoformat(sl["start"])) == "on_peak" for sl in plans[0].slots)


def test_battery_adds_headroom():
    s = Session("x", need_kwh=7, departure=NOW + timedelta(hours=1), max_kw=7.2)
    no_bat, _ = schedule([s], NOW, flat(150), Sources(Grid(150)), ULO)
    assert no_bat[0].planned_kwh == 0
    bat, _ = schedule([s], NOW, flat(150), Sources(Grid(150), Battery(100, 20, 80)), ULO)
    assert bat[0].shortfall_kwh == 0


def test_partial_current_interval():
    now = NOW + timedelta(minutes=10)
    s = Session("x", need_kwh=100, departure=now + timedelta(minutes=20), max_kw=8)
    plans, _ = schedule([s], now, flat(0), Sources(Grid(100)), ULO)
    first = plans[0].slots[0]
    assert datetime.fromisoformat(first["start"]) == floor_step(now)
    # Only 5 of the 15 minutes remain: 8 kW × 5 min ≈ 0.667 kWh.
    assert abs(plans[0].planned_kwh - (8 * STEP_H / 3 + 8 * STEP_H)) < 0.05
