"""Ontario electricity pricing: Time-of-Use (TOU) and Ultra-Low Overnight (ULO).

Prices are the Ontario Energy Board's Regulated Price Plan rates effective
1 November 2024 (¢/kWh). The OEB resets them every 1 November: check
https://www.oeb.ca/choosing-your-electricity-price-plan and override via
TARIFF_* environment variables or `Tariff(...)` without code changes.
Weekends and Ontario's TOU holidays are off-peak all day.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from functools import lru_cache
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Toronto")


@dataclass(frozen=True)
class Tariff:
    plan: str = "ulo"  # "tou" | "ulo"
    # ¢/kWh
    tou: dict = field(default_factory=lambda: {"off_peak": 7.6, "mid_peak": 12.2, "on_peak": 15.8})
    ulo: dict = field(default_factory=lambda: {"ultra_low": 2.8, "weekend_off_peak": 7.6, "mid_peak": 12.2, "on_peak": 28.4})
    # Grid carbon intensity, kg CO2e per kWh (Ontario's grid is mostly nuclear/hydro).
    carbon_kg_per_kwh: float = 0.030

    def period(self, t: datetime) -> str:
        local = t.astimezone(TZ)
        return ulo_period(local) if self.plan == "ulo" else tou_period(local)

    def price_cents(self, t: datetime) -> float:
        p = self.period(t)
        return (self.ulo if self.plan == "ulo" else self.tou)[p]

    def price_per_kwh(self, t: datetime) -> float:
        return self.price_cents(t) / 100


def tou_period(t: datetime) -> str:
    if is_off_peak_day(t.date()):
        return "off_peak"
    h = t.hour
    winter = t.month >= 11 or t.month <= 4
    if h < 7 or h >= 19:
        return "off_peak"
    if winter:
        return "on_peak" if (7 <= h < 11 or 17 <= h < 19) else "mid_peak"
    return "on_peak" if 11 <= h < 17 else "mid_peak"


def ulo_period(t: datetime) -> str:
    h = t.hour
    if h >= 23 or h < 7:
        return "ultra_low"  # every day, including weekends and holidays
    if is_off_peak_day(t.date()):
        return "weekend_off_peak"
    if 16 <= h < 21:
        return "on_peak"
    return "mid_peak"


def is_off_peak_day(d: date) -> bool:
    return d.weekday() >= 5 or d in ontario_holidays(d.year)


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    d = date(year, month, 1)
    d += timedelta(days=(weekday - d.weekday()) % 7)
    return d + timedelta(weeks=n - 1)


def _easter(year: int) -> date:
    a, b, c = year % 19, year // 100, year % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


@lru_cache(maxsize=32)
def ontario_holidays(year: int) -> frozenset[date]:
    fixed = [date(year, 1, 1), date(year, 7, 1), date(year, 12, 25), date(year, 12, 26)]
    days: set[date] = {
        _nth_weekday(year, 2, 0, 3),                        # Family Day
        _easter(year) - timedelta(days=2),                  # Good Friday
        date(year, 5, 25) - timedelta(days=(date(year, 5, 25).weekday() - 0) % 7 or 7),  # Victoria Day
        _nth_weekday(year, 8, 0, 1),                        # Civic Holiday
        _nth_weekday(year, 9, 0, 1),                        # Labour Day
        _nth_weekday(year, 10, 0, 2),                       # Thanksgiving
    }
    # Fixed-date holidays on a weekend move to the next free weekday.
    for d in fixed:
        while d.weekday() >= 5 or d in days:
            d += timedelta(days=1)
        days.add(d)
    return frozenset(days)
