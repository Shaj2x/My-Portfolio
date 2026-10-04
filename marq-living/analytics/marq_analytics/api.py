"""HTTP API for the web app and the automation engine."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Query

from . import energy
from .config import Settings, tariff

settings = Settings()
app = FastAPI(title="Marq Living analytics", version="1.0")


def auth(x_api_key: Annotated[str | None, Header()] = None) -> None:
    if settings.api_key and x_api_key != settings.api_key:
        raise HTTPException(401, "bad api key")


Auth = Depends(auth)


def window(start: datetime | None, end: datetime | None, default_days: float = 1) -> tuple[datetime, datetime]:
    end = end or datetime.now(timezone.utc)
    start = start or end - timedelta(days=default_days)
    if start >= end:
        raise HTTPException(400, "from must be before to")
    if end - start > timedelta(days=400):
        raise HTTPException(400, "window too large")
    return start, end


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.get("/energy/live", dependencies=[Auth])
def energy_live() -> dict:
    return energy.live(settings.tsdb_url, settings.app_url)


@app.get("/energy/series", dependencies=[Auth])
def energy_series(start: Annotated[datetime | None, Query(alias="from")] = None,
                  end: Annotated[datetime | None, Query(alias="to")] = None) -> dict:
    s, e = window(start, end)
    return energy.series(settings.tsdb_url, settings.app_url, s, e)


@app.get("/energy/summary", dependencies=[Auth])
def energy_summary(start: Annotated[datetime | None, Query(alias="from")] = None,
                   end: Annotated[datetime | None, Query(alias="to")] = None) -> dict:
    s, e = window(start, end, 30)
    return energy.summary(settings.tsdb_url, settings.app_url, s, e, tariff(settings))


@app.get("/energy/savings", dependencies=[Auth])
def energy_savings(start: Annotated[datetime | None, Query(alias="from")] = None,
                   end: Annotated[datetime | None, Query(alias="to")] = None) -> dict:
    s, e = window(start, end, 30)
    return energy.room_savings(settings.tsdb_url, settings.app_url, s, e, tariff(settings))


# ---------------------------------------------------------------------------
# Stage 8: forecasting, EV scheduling, shuttle electrification, anomalies
# ---------------------------------------------------------------------------

from contextlib import asynccontextmanager  # noqa: E402

from . import forecast as fc  # noqa: E402
from . import jobs  # noqa: E402
from .shuttle import Assumptions  # noqa: E402


@app.get("/forecast", dependencies=[Auth])
def get_forecast(start: Annotated[datetime | None, Query(alias="from")] = None,
                 end: Annotated[datetime | None, Query(alias="to")] = None) -> dict:
    now = datetime.now(timezone.utc)
    s, e = (start or now - timedelta(hours=12)), (end or now + timedelta(hours=36))
    rows = jobs.latest_forecast(settings, s, e)
    from .db import peak_limit_kw
    limit = peak_limit_kw(settings.app_url) or 150.0
    pts = [{"t": r["timestamp"].isoformat(), "predicted_kw": float(r["predicted_kw"]), "lower_kw": float(r["lower_kw"] or 0),
            "upper_kw": float(r["upper_kw"] or 0), "actual_kw": float(r["actual_kw"]) if r["actual_kw"] is not None else None} for r in rows]
    done = [p for p in pts if p["actual_kw"] is not None and p["actual_kw"] > 0.5]
    mape = sum(abs(p["predicted_kw"] - p["actual_kw"]) / p["actual_kw"] for p in done) / len(done) * 100 if done else None
    return {"points": pts, "limit_kw": limit, "model": rows[-1]["model"] if rows else None,
            "mape_pct": round(mape, 1) if mape is not None else None, "recommendations": fc.peak_actions(pts, limit)}


@app.post("/forecast/run", dependencies=[Auth])
def post_forecast() -> dict:
    r = jobs.run_forecast(settings)
    return {k: v for k, v in r.items() if k != "points"}


@app.post("/ev/schedule", dependencies=[Auth])
def post_ev_schedule() -> dict:
    return jobs.schedule_ev(settings)


@app.get("/shuttle/electrification", dependencies=[Auth])
def get_electrification(kwh_per_km: float = 0.32, charger_kw: float = 19.2, winter_factor: float = 1.35) -> dict:
    return jobs.electrification(settings, Assumptions(kwh_per_km=kwh_per_km, charger_kw=charger_kw, winter_factor=winter_factor))


@app.post("/anomalies/run", dependencies=[Auth])
def post_anomalies() -> dict:
    return {"found": jobs.detect_anomalies(settings)}


def _start_scheduler():
    from apscheduler.schedulers.background import BackgroundScheduler
    sched = BackgroundScheduler(timezone="America/Toronto")

    def safe(f):
        def run():
            try:
                f(settings)
            except Exception:  # keep the scheduler alive; errors are logged
                logging.getLogger("marq_analytics").exception("job %s failed", f.__name__)
        return run

    sched.add_job(safe(jobs.run_forecast), "cron", hour=21, minute=30)
    sched.add_job(safe(jobs.update_actuals), "cron", minute=5)
    sched.add_job(safe(jobs.schedule_ev), "interval", minutes=5)
    sched.add_job(safe(jobs.detect_anomalies), "cron", minute=10)
    sched.start()
    # Make sure tomorrow has a forecast after a restart.
    sched.add_job(safe(jobs.run_forecast), "date")
    return sched


import logging  # noqa: E402


@asynccontextmanager
async def lifespan(_app):
    sched = _start_scheduler() if settings.scheduler else None
    yield
    if sched:
        sched.shutdown(wait=False)


app.router.lifespan_context = lifespan
