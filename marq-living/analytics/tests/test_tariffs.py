from datetime import date, datetime

from marq_analytics.tariffs import TZ, Tariff, ontario_holidays, tou_period, ulo_period


def at(y, m, d, h, mi=0):
    return datetime(y, m, d, h, mi, tzinfo=TZ)


def test_ulo_periods():
    assert ulo_period(at(2026, 10, 7, 23, 30)) == "ultra_low"
    assert ulo_period(at(2026, 10, 7, 6, 59)) == "ultra_low"
    assert ulo_period(at(2026, 10, 7, 16)) == "on_peak"       # Wednesday
    assert ulo_period(at(2026, 10, 7, 21, 30)) == "mid_peak"
    assert ulo_period(at(2026, 10, 10, 16)) == "weekend_off_peak"  # Saturday
    assert ulo_period(at(2026, 10, 12, 17)) == "weekend_off_peak"  # Thanksgiving Monday


def test_tou_seasons():
    assert tou_period(at(2026, 1, 14, 8)) == "on_peak"    # winter morning
    assert tou_period(at(2026, 1, 14, 13)) == "mid_peak"
    assert tou_period(at(2026, 7, 15, 13)) == "on_peak"   # summer afternoon
    assert tou_period(at(2026, 7, 15, 8)) == "mid_peak"
    assert tou_period(at(2026, 7, 15, 20)) == "off_peak"
    assert tou_period(at(2026, 7, 18, 13)) == "off_peak"  # Saturday


def test_holidays_2026():
    h = ontario_holidays(2026)
    for d in [date(2026, 1, 1), date(2026, 2, 16), date(2026, 4, 3), date(2026, 5, 18), date(2026, 7, 1),
              date(2026, 8, 3), date(2026, 9, 7), date(2026, 10, 12), date(2026, 12, 25), date(2026, 12, 28)]:
        assert d in h, d  # Boxing Day 2026 is a Saturday → observed Monday the 28th
    assert len(h) == 10


def test_prices_and_carbon():
    t = Tariff(plan="ulo")
    assert t.price_cents(at(2026, 10, 7, 2)) == 2.8
    assert t.price_cents(at(2026, 10, 7, 18)) == 28.4
    assert Tariff(plan="tou").price_per_kwh(at(2026, 10, 7, 2)) == 0.076
