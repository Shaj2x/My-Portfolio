import os
from dataclasses import dataclass

from .tariffs import Tariff


@dataclass(frozen=True)
class Settings:
    tsdb_url: str = os.environ.get("TIMESCALE_URL", "postgresql://postgres:postgres@localhost:5433/telemetry")
    app_url: str = os.environ.get("SUPABASE_DB_URL", "postgresql://postgres:postgres@localhost:54322/postgres")
    api_key: str = os.environ.get("ANALYTICS_API_KEY", "")
    scheduler: bool = os.environ.get("SCHEDULER_ENABLED", "false").lower() == "true"
    weather_url: str = os.environ.get("WEATHER_URL", "https://api.open-meteo.com/v1/forecast")
    lat: float = float(os.environ.get("SITE_LAT", "42.9920"))
    lng: float = float(os.environ.get("SITE_LNG", "-81.2510"))
    tariff_plan: str = os.environ.get("TARIFF_PLAN", "ulo")


def tariff(s: Settings) -> Tariff:
    return Tariff(plan=s.tariff_plan)
