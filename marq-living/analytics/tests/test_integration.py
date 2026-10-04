"""Energy reporting against real databases filled by the simulator backfill.
Run with: scripts/with-test-db.sh python -m pytest analytics/tests/test_integration.py"""
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg
import pytest

APP, TSDB = os.environ.get("APP_DB_URL"), os.environ.get("TSDB_URL")
pytestmark = pytest.mark.skipif(not APP or not TSDB, reason="needs scripts/with-test-db.sh")

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "simulator"))


@pytest.fixture(scope="module")
def filled():
    from marq_sim import backfill, catalog
    with psycopg.connect(APP) as c:
        catalog.seed(c)
    n = backfill.backfill(TSDB, APP, days=6, automation_from_day=3)
    with psycopg.connect(TSDB, autocommit=True) as c:
        c.execute("refresh materialized view readings_15m") if c.execute(
            "select 1 from pg_matviews where matviewname = 'readings_15m'").fetchone() else None
    return n


def test_backfill_wrote_history(filled):
    assert filled > 6 * 1440 * 15


def test_summary_by_system_and_period(filled):
    from marq_analytics import energy
    from marq_analytics.tariffs import Tariff
    end = datetime.now(timezone.utc)
    s = energy.summary(TSDB, APP, end - timedelta(days=6), end, Tariff(plan="ulo"))
    systems = {x["system"] for x in s["by_system"]}
    assert {"laundry", "theatre", "game_room", "common", "ev"} <= systems, systems
    assert s["total_kwh"] > 100 and s["total_cost"] > 0 and s["peak_kw"] > 3
    assert abs(sum(p["kwh"] for p in s["by_period"]) - s["total_kwh"]) < 0.1
    assert {p["period"] for p in s["by_period"]} <= {"ultra_low", "weekend_off_peak", "mid_peak", "on_peak"}


def test_series_has_15_minute_points(filled):
    from marq_analytics import energy
    end = datetime.now(timezone.utc)
    s = energy.series(TSDB, APP, end - timedelta(days=1), end)
    assert 90 <= len(s["points"]) <= 97
    assert all(p["total"] >= 0 for p in s["points"])


def test_savings_after_automation(filled):
    from marq_analytics import energy
    from marq_analytics.tariffs import Tariff
    end = datetime.now(timezone.utc)
    sav = energy.room_savings(TSDB, APP, end - timedelta(days=2), end, Tariff())
    theatre = next(r for r in sav["rooms"] if r["room"] == "theatre")
    assert theatre["saved_pct"] > 30, theatre
    assert sav["total_saved_cost"] > 0


def test_live_view_maps_channels(filled):
    from marq_analytics import energy
    with psycopg.connect(TSDB, autocommit=True) as c:
        c.execute("""insert into readings (ts, device_id, channel, current_a, power_w, energy_kwh)
                     select now(), device_id, channel, 1, 500, 1 from (select distinct device_id, channel from readings) x""")
    live = energy.live(TSDB, APP)
    assert live["total_kw"] > 0 and live["peak_limit_kw"] == 150
    assert any(ch["label"] == "Washer 1" and ch["system"] == "laundry" for ch in live["channels"])
