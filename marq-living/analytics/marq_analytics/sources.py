"""Energy sources the scheduler can dispatch. Grid today; an on-site battery
or solar array is added by registering a row in public.energy_sources —
the scheduler only sees the combined headroom each interval."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Grid:
    peak_limit_kw: float

    def headroom_kw(self, base_kw: float) -> float:
        return max(self.peak_limit_kw - base_kw, 0.0)


@dataclass
class Battery:
    capacity_kwh: float
    max_discharge_kw: float
    soc_kwh: float
    reserve_kwh: float = 0.0

    def available_kw(self, hours: float) -> float:
        return max(0.0, min(self.max_discharge_kw, (self.soc_kwh - self.reserve_kwh) / hours)) if hours > 0 else 0.0


@dataclass
class Solar:
    forecast_kw: list[float]  # per interval

    def at(self, i: int) -> float:
        return self.forecast_kw[i] if i < len(self.forecast_kw) else 0.0


@dataclass
class Sources:
    grid: Grid
    battery: Battery | None = None
    solar: Solar | None = None

    def headroom(self, i: int, base_kw: float, interval_h: float) -> float:
        """kW available for flexible loads in interval i without exceeding the grid limit."""
        extra = (self.solar.at(i) if self.solar else 0.0) + (self.battery.available_kw(interval_h) if self.battery else 0.0)
        return max(self.grid.peak_limit_kw + extra - base_kw, 0.0)
