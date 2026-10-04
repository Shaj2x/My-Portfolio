"""Physical models for simulated devices. Pure functions/classes: no I/O."""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field

# --- Laundry -----------------------------------------------------------------

# (minutes, watts) phases. Washers agitate around the phase mean; dryers
# cycle the heater on/off with the motor always running.
WASHER_PHASES = [(5, 60), (15, 350), (8, 200), (7, 520)]
DRYER_HEAT_MIN, DRYER_COOL_MIN = 45, 5
DRYER_MOTOR_W, DRYER_HEATER_W = 300, 5000


@dataclass
class Machine:
    kind: str  # washer | dryer
    started_at: float | None = None  # seconds (sim clock)
    heater_failed: bool = False
    rng: random.Random = field(default_factory=random.Random)

    @property
    def cycle_s(self) -> float:
        if self.kind == "washer":
            return sum(m for m, _ in WASHER_PHASES) * 60
        return (DRYER_HEAT_MIN + DRYER_COOL_MIN) * 60

    def busy(self, now: float) -> bool:
        return self.started_at is not None and now - self.started_at < self.cycle_s

    def start(self, now: float) -> bool:
        if self.busy(now):
            return False
        self.started_at = now
        return True

    def power(self, now: float) -> float:
        if not self.busy(now):
            self.started_at = None if self.started_at is not None and now - self.started_at >= self.cycle_s else self.started_at
            return self.rng.uniform(0.5, 3.0)  # standby electronics
        t = (now - self.started_at) / 60
        if self.kind == "washer":
            for minutes, watts in WASHER_PHASES:
                if t < minutes:
                    return max(0.0, watts * self.rng.uniform(0.85, 1.15))
                t -= minutes
            return 2.0
        if t < DRYER_HEAT_MIN and not self.heater_failed:
            # Thermostat cycling: heater on 80% of each 4-minute period.
            heater = DRYER_HEATER_W if (t % 4) < 3.2 else 0
            return DRYER_MOTOR_W * self.rng.uniform(0.95, 1.05) + heater
        return DRYER_MOTOR_W * self.rng.uniform(0.95, 1.05)


def laundry_arrival_rate(hour: int, weekend: bool) -> float:
    """Expected cycle starts per machine per hour (student building: evenings, weekends)."""
    base = [0.02, 0.01, 0.0, 0.0, 0.0, 0.0, 0.01, 0.05, 0.1, 0.15, 0.2, 0.25,
            0.25, 0.2, 0.2, 0.25, 0.35, 0.45, 0.55, 0.6, 0.6, 0.5, 0.3, 0.1]
    return base[hour] * (1.4 if weekend else 1.0)


# --- Rooms (theatre, game room) --------------------------------------------------

FAILSAFE_AFTER_S = 120


@dataclass
class Room:
    lights_w: float
    hvac_comfort_w: float
    hvac_setback_w: float = 250.0
    lights_on: bool = True        # fail-safe default
    hvac_mode: str = "comfort"    # comfort | setback | off
    last_heartbeat: float | None = None
    failsafe: bool = False
    manual_override: bool = False

    def heartbeat(self, now: float) -> None:
        self.last_heartbeat = now
        self.failsafe = False

    def check_failsafe(self, now: float) -> bool:
        """Revert to lights on / HVAC normal if the engine has gone quiet. Returns True when it trips."""
        if self.failsafe:
            return False
        if self.last_heartbeat is None or now - self.last_heartbeat > FAILSAFE_AFTER_S:
            self.failsafe = True
            changed = not self.lights_on or self.hvac_mode != "comfort"
            self.lights_on, self.hvac_mode = True, "comfort"
            return changed
        return False

    def command(self, relay: str, state: str) -> tuple[bool, str | None]:
        if self.manual_override:
            return False, "manual override active"
        if relay == "lights":
            self.lights_on = state == "on"
        elif relay == "hvac":
            if state not in ("comfort", "setback", "off"):
                return False, f"bad hvac mode {state}"
            self.hvac_mode = state
        else:
            return False, f"unknown output {relay}"
        return True, None

    def power(self, now: float, rng: random.Random) -> tuple[float, float]:
        lights = self.lights_w * rng.uniform(0.97, 1.03) if self.lights_on else rng.uniform(0, 2)
        if self.hvac_mode == "comfort":
            # Compressor/fan duty cycle around 60%.
            hvac = self.hvac_comfort_w if (now / 60) % 10 < 6 else 150
        elif self.hvac_mode == "setback":
            hvac = self.hvac_setback_w if (now / 60) % 10 < 3 else 40
        else:
            hvac = 5
        return lights, hvac * rng.uniform(0.95, 1.05)


# --- Building base loads ------------------------------------------------------------

def lobby_power(hour: float, rng: random.Random) -> float:
    """Lobby lighting + elevators + misc: always on, busier by day."""
    day = 0.5 + 0.5 * math.sin((hour - 7) / 24 * 2 * math.pi) if 6 <= hour <= 23 else 0.15
    return 1800 + 2200 * max(day, 0.15) + rng.uniform(-150, 150)


# --- EV charging ----------------------------------------------------------------------

@dataclass
class Charger:
    max_kw: float = 7.2
    limit_kw: float | None = None   # set by load management
    connected: bool = False
    target_kwh: float = 0.0
    delivered_kwh: float = 0.0
    energy_counter_wh: float = 0.0

    def plug_in(self, target_kwh: float) -> None:
        self.connected, self.target_kwh, self.delivered_kwh = True, target_kwh, 0.0

    def unplug(self) -> None:
        self.connected = False

    def step(self, dt_s: float) -> float:
        """Advance dt seconds; returns power in W."""
        if not self.connected or self.delivered_kwh >= self.target_kwh:
            return 0.0
        kw = min(self.max_kw, self.limit_kw if self.limit_kw is not None else self.max_kw)
        # Taper over the last 10% (CC/CV).
        remaining = self.target_kwh - self.delivered_kwh
        if remaining < 0.1 * self.target_kwh:
            kw *= max(0.3, remaining / (0.1 * self.target_kwh))
        kwh = min(kw * dt_s / 3600, remaining)
        self.delivered_kwh += kwh
        self.energy_counter_wh += kwh * 1000
        return kwh / (dt_s / 3600) * 1000 if dt_s > 0 else 0.0


# --- Shuttle ------------------------------------------------------------------------------

def haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    r = 6371008.8
    la1, lo1, la2, lo2 = map(math.radians, (*a, *b))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def position_along(path: list[tuple[float, float]], meters: float) -> tuple[tuple[float, float], bool]:
    """Point `meters` along a polyline; second value is True once past the end."""
    left = meters
    for a, b in zip(path, path[1:]):
        seg = haversine_m(a, b)
        if left <= seg:
            f = left / seg if seg else 0
            return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f), False
        left -= seg
    return path[-1], True


@dataclass
class Battery:
    capacity_kwh: float = 60.0
    soc_pct: float = 90.0
    kwh_per_km: float = 0.35

    def drive(self, km: float) -> None:
        self.soc_pct = max(0.0, self.soc_pct - km * self.kwh_per_km / self.capacity_kwh * 100)

    def charge(self, kw: float, dt_s: float) -> float:
        if self.soc_pct >= 100:
            return 0.0
        add = kw * dt_s / 3600
        self.soc_pct = min(100.0, self.soc_pct + add / self.capacity_kwh * 100)
        return kw * 1000
