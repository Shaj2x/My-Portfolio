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
