"""Hourly temperature for London, Ontario from Open-Meteo (no key needed),
with a climatology fallback so forecasting still works offline."""
from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta, timezone

import httpx

log = logging.getLogger(__name__)

# Monthly mean temperature, London ON (°C), Jan..Dec; daily swing ±5 °C.
CLIMATE = [-6.0, -5.2, -0.5, 6.6, 13.3, 18.6, 21.0, 20.0, 15.8, 9.3, 3.4, -2.8]


def climatology(t: datetime) -> float:
    local_hour = (t.astimezone(timezone(timedelta(hours=-5))).hour)
    return CLIMATE[t.month - 1] + 5 * math.sin((local_hour - 9) / 24 * 2 * math.pi)


def hourly_temps(url: str, lat: float, lng: float, start: datetime, end: datetime) -> dict[datetime, float]:
    """UTC hour → °C. Falls back to climatology for anything not returned."""
    out: dict[datetime, float] = {}
    try:
        past_days = max(0, min(92, (datetime.now(timezone.utc) - start).days + 1))
        r = httpx.get(url, params={"latitude": lat, "longitude": lng, "hourly": "temperature_2m", "timezone": "UTC",
                                   "past_days": past_days, "forecast_days": 3}, timeout=8)
        r.raise_for_status()
        h = r.json()["hourly"]
        for ts, temp in zip(h["time"], h["temperature_2m"]):
            if temp is not None:
                out[datetime.fromisoformat(ts).replace(tzinfo=timezone.utc)] = float(temp)
    except Exception as e:  # network/off-site: climatology is good enough for load shape
        log.warning("weather unavailable, using climatology: %s", e)
    t = start.replace(minute=0, second=0, microsecond=0)
    while t <= end:
        out.setdefault(t, climatology(t))
        t += timedelta(hours=1)
    return out
