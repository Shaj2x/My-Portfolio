import random

from marq_sim import models as m


def test_washer_cycle_profile_and_end():
    w = m.Machine("washer", rng=random.Random(1))
    assert w.start(0)
    assert not w.start(60), "can't start while busy"
    assert 40 < w.power(2 * 60) < 80          # filling
    assert 290 < w.power(10 * 60) < 410       # washing
    assert 430 < w.power(32 * 60) < 600       # spin
    assert w.power(36 * 60) < 5               # done
    assert not w.busy(36 * 60)


def test_dryer_heats_and_cools_and_can_fail():
    d = m.Machine("dryer", rng=random.Random(1))
    d.start(0)
    samples = [d.power(t) for t in range(0, 45 * 60, 30)]
    assert max(samples) > 5000 and min(samples) < 400, "heater cycles on and off"
    assert d.power(47 * 60) < 400, "cool-down is motor only"
    bad = m.Machine("dryer", heater_failed=True, rng=random.Random(1))
    bad.start(0)
    assert all(p < 400 for p in (bad.power(t) for t in range(0, 45 * 60, 30)))


def test_room_failsafe_and_override():
    r = m.Room(lights_w=600, hvac_comfort_w=2000)
    r.heartbeat(0)
    assert r.command("lights", "off") == (True, None)
    assert r.command("hvac", "setback") == (True, None)
    assert not r.check_failsafe(100)
    assert r.check_failsafe(130), "engine silent > 120 s"
    assert r.lights_on and r.hvac_mode == "comfort"
    r.manual_override = True
    ok, err = r.command("lights", "off")
    assert not ok and "manual" in err
    assert r.command("fan", "on")[0] is False


def test_room_power_follows_state():
    rng = random.Random(1)
    r = m.Room(lights_w=600, hvac_comfort_w=2000)
    lights, _ = r.power(0, rng)
    assert 570 < lights < 630
    r.command("lights", "off")
    r.command("hvac", "off")
    lights, hvac = r.power(0, rng)
    assert lights < 3 and hvac < 10


def test_charger_respects_limit_and_target():
    c = m.Charger(max_kw=7.2)
    c.plug_in(10)
    c.limit_kw = 3.6
    p = c.step(60)
    assert abs(p - 3600) < 1
    for _ in range(2000):
        c.step(60)
    assert abs(c.delivered_kwh - 10) < 1e-6
    assert c.step(60) == 0
    assert abs(c.energy_counter_wh - 10000) < 1e-3


def test_position_along_path():
    path = [(42.99, -81.25), (42.99, -81.24)]
    total = m.haversine_m(*path)
    mid, done = m.position_along(path, total / 2)
    assert not done and abs(mid[1] - (-81.245)) < 1e-6
    end, done = m.position_along(path, total + 10)
    assert done and end == path[-1]


def test_battery():
    b = m.Battery(capacity_kwh=60, soc_pct=50, kwh_per_km=0.35)
    b.drive(12)
    assert abs(b.soc_pct - (50 - 12 * 0.35 / 60 * 100)) < 1e-9
    b.charge(30, 3600)  # +30 kWh = +50 %
    assert abs(b.soc_pct - 93.0) < 1e-9
    b.charge(30, 3600)
    assert b.soc_pct == 100, "capped at full"



def test_arrival_rates_peak_in_evening():
    assert m.laundry_arrival_rate(19, False) > m.laundry_arrival_rate(9, False) > m.laundry_arrival_rate(3, False)
