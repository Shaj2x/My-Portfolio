from datetime import datetime
from zoneinfo import ZoneInfo

from marq_sim import backfill, catalog


def test_generate_shapes_and_automation_savings():
    end = datetime(2026, 9, 28, 0, 0, tzinfo=ZoneInfo("America/Toronto"))  # a Monday
    rows = list(backfill.generate(days=4, automation_from_day=2, end=end))
    channels = len(catalog.LAUNDRY) + 2 * len(catalog.ROOMS) + 1 + len(catalog.CHARGERS)
    assert len(rows) == 4 * 1440 * channels
    # Energy counters only increase.
    last = {}
    for _, hw, ch, _, w, kwh in rows:
        assert w >= 0
        assert kwh >= last.get((hw, ch), 0)
        last[(hw, ch)] = kwh
    # Theatre lights use far less energy once automation follows bookings.
    def theatre_kwh(day):
        return sum(w for t, hw, ch, _, w, _ in rows if hw == "sim-ct-theatre" and (t.astimezone(end.tzinfo) - (end.replace(day=24))).days == day) / 60 / 1000
    before, after = theatre_kwh(0) + theatre_kwh(1), theatre_kwh(2) + theatre_kwh(3)
    assert after < 0.6 * before, (before, after)


def test_room_schedule_is_evening_heavy():
    import random
    day = datetime(2026, 10, 3, tzinfo=ZoneInfo("America/Toronto"))  # Saturday
    slots = [s for _ in range(50) for s in backfill.room_schedule(day, random.Random(_))]
    assert all(13 <= s.hour <= 21 for s, _ in slots)
