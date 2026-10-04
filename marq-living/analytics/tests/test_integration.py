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
    n = backfill.backfill(TSDB, APP, days=10, automation_from_day=5)
    with psycopg.connect(TSDB, autocommit=True) as c:
        c.execute("refresh materialized view readings_15m") if c.execute(
            "select 1 from pg_matviews where matviewname = 'readings_15m'").fetchone() else None
    return n


def test_backfill_wrote_history(filled):
    assert filled > 10 * 1440 * 15


def test_summary_by_system_and_period(filled):
    from marq_analytics import energy
    from marq_analytics.tariffs import Tariff
    end = datetime.now(timezone.utc)
    s = energy.summary(TSDB, APP, end - timedelta(days=10), end, Tariff(plan="ulo"))
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


@pytest.fixture(scope="module")
def settings(filled):
    from marq_analytics.config import Settings
    return Settings(tsdb_url=TSDB, app_url=APP, weather_url="http://127.0.0.1:9/offline")


def test_forecast_job_stores_next_day(settings):
    from marq_analytics import jobs
    r = jobs.run_forecast(settings)
    assert r["model"] == "gbr-v1" and len(r["points"]) == 96
    with psycopg.connect(APP) as c:
        n = c.execute("select count(*) from public.forecasts").fetchone()[0]
    assert n == 96
    assert jobs.update_actuals(settings) >= 0


def test_ev_schedule_assigns_charger_and_plans_overnight(settings):
    from marq_analytics import jobs
    from marq_analytics.tariffs import Tariff
    with psycopg.connect(APP) as c:
        c.execute("""insert into auth.users (id, email, raw_user_meta_data) values
                     ('a7000000-0000-0000-0000-000000000007', 'ev@marq.test', '{"full_name":"Eve","unit":"707","room_letter":"A","floor":"7"}')""")
        c.execute("update public.profiles set status = 'approved' where id = 'a7000000-0000-0000-0000-000000000007'")
        c.execute("""insert into public.ev_sessions (tenant_id, requested_kwh, departure_time)
                     values ('a7000000-0000-0000-0000-000000000007', 20, now() + interval '20 hours')""")
    r = jobs.schedule_ev(settings)
    assert r["sessions"] >= 1 and r["peak_kw"] <= r["limit_kw"] + 1e-6
    with psycopg.connect(APP) as c:
        row = c.execute("""select charger_id, status, plan, est_complete_at from public.ev_sessions
                            where tenant_id = 'a7000000-0000-0000-0000-000000000007'""").fetchone()
        note = c.execute("select count(*) from public.notifications where kind = 'ev_update'").fetchone()[0]
    charger, status, plan, done = row
    assert charger is not None and status == "scheduled" and done is not None
    slots = plan["slots"]
    assert abs(plan["planned_kwh"] - 20) < 0.01 and plan["shortfall_kwh"] == 0
    assert all(sl["kw"] <= 7.2 for sl in slots)
    ulo = Tariff(plan="ulo")
    from datetime import datetime as dt
    share = sum(1 for sl in slots if ulo.period(dt.fromisoformat(sl["start"])) == "ultra_low") / len(slots)
    assert share > 0.9, share
    assert note == 1


def test_electrification_from_logged_runs(settings):
    from marq_analytics import jobs
    rep = jobs.electrification(settings)
    assert rep["stats"]["runs"] > 50
    assert rep["recommended_pack_kwh"] >= rep["required_battery_kwh"] > 0
    assert rep["feasible"]


def test_anomaly_detection_flags_unusual_hour(settings):
    from marq_analytics import jobs
    with psycopg.connect(TSDB, autocommit=True) as c:
        dev = c.execute("select device_id from readings group by 1 limit 1").fetchone()[0]
        c.execute("""insert into readings (ts, device_id, channel, current_a, power_w, energy_kwh)
                     select g, %s, 7, 40, 4800, 0 from generate_series(date_trunc('hour', now()) - interval '1 hour', date_trunc('hour', now()) - interval '1 minute', interval '1 minute') g""", (dev,))
        c.execute("""insert into readings (ts, device_id, channel, current_a, power_w, energy_kwh)
                     select g, %s, 7, 0.1, 10, 0 from generate_series(now() - interval '9 days', date_trunc('hour', now()) - interval '61 minutes', interval '15 minutes') g""", (dev,))
        if c.execute("select 1 from pg_matviews where matviewname = 'readings_15m'").fetchone():
            c.execute("refresh materialized view readings_15m")
    found = jobs.detect_anomalies(settings)
    assert any(f["channel"] == 7 for f in found), found
    with psycopg.connect(APP) as c:
        assert c.execute("select count(*) from public.device_events where type = 'anomaly'").fetchone()[0] >= 1
    jobs.detect_anomalies(settings)
    with psycopg.connect(APP) as c:
        n = c.execute("select count(*) from public.device_events where type = 'anomaly' and (payload->>'channel')::int = 7").fetchone()[0]
    assert n == 1, "an anomaly is recorded once per 6 hours"
