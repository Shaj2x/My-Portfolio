"""Next-day building load forecast in 15-minute intervals.

Features: time of day, day of week, weekend/holiday, temperature,
heating/cooling degrees, booked rooms, shuttle departures, and the same
interval yesterday and last week. Model: gradient boosting for the median
with quantile models for an 80% band. With under a week of history the
model can't learn weekly shape, so a seasonal-naive profile is used instead.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor

from .tariffs import TZ, is_off_peak_day

STEP = timedelta(minutes=15)
FEATURES = ["sin_t", "cos_t", "dow", "off_day", "temp", "hdd", "cdd", "bookings", "shuttle", "lag_1d", "lag_7d"]


@dataclass
class ForecastResult:
    model: str
    points: list[dict]  # {"t": iso, "predicted_kw", "lower_kw", "upper_kw"}
    mape: float | None   # on the most recent held-out day, %
    trained_on: int


def features(index: pd.DatetimeIndex, load: pd.Series, temps: dict, bookings: pd.Series, shuttle: pd.Series) -> pd.DataFrame:
    local = index.tz_convert(TZ)
    minutes = local.hour * 60 + local.minute
    df = pd.DataFrame(index=index)
    df["sin_t"] = np.sin(2 * np.pi * minutes / 1440)
    df["cos_t"] = np.cos(2 * np.pi * minutes / 1440)
    df["dow"] = local.dayofweek
    df["off_day"] = [1.0 if is_off_peak_day(d.date()) else 0.0 for d in local]
    df["temp"] = [temps.get(t.floor("h").to_pydatetime(), np.nan) for t in index]
    df["temp"] = df["temp"].interpolate(limit_direction="both").fillna(10.0)
    df["hdd"] = (18 - df["temp"]).clip(lower=0)
    df["cdd"] = (df["temp"] - 22).clip(lower=0)
    df["bookings"] = bookings.reindex(index).fillna(0).values
    df["shuttle"] = shuttle.reindex(index).fillna(0).values
    df["lag_1d"] = load.reindex(index - pd.Timedelta(days=1)).values
    df["lag_7d"] = load.reindex(index - pd.Timedelta(days=7)).values
    df["lag_7d"] = df["lag_7d"].fillna(df["lag_1d"])
    return df


def seasonal_naive(load: pd.Series, index: pd.DatetimeIndex) -> np.ndarray:
    """Mean of the same interval over the available previous days."""
    by_slot = load.groupby([load.index.tz_convert(TZ).hour, load.index.tz_convert(TZ).minute]).mean()
    local = index.tz_convert(TZ)
    overall = float(load.mean()) if len(load) else 0.0
    return np.array([by_slot.get((h, m), overall) for h, m in zip(local.hour, local.minute)])


def forecast(load: pd.Series, temps: dict, bookings: pd.Series, shuttle: pd.Series, day_start: datetime) -> ForecastResult:
    """load: kW per 15-min interval (UTC index). Forecasts 96 intervals from day_start."""
    load = load.sort_index().asfreq("15min")
    target = pd.date_range(day_start, periods=96, freq="15min", tz=timezone.utc)
    history_days = (load.dropna().index.max() - load.dropna().index.min()).days if load.notna().any() else 0

    if history_days < 8:
        pred = seasonal_naive(load.dropna(), target) if load.notna().any() else np.zeros(96)
        spread = float(load.std()) if load.notna().sum() > 10 else max(pred.mean() * 0.2, 1)
        return ForecastResult("seasonal-naive", _points(target, pred, pred - 1.28 * spread, pred + 1.28 * spread), None, int(load.notna().sum()))

    full_index = load.index.union(target)
    X_all = features(full_index, load, temps, bookings, shuttle)
    # Lag features for the target day refer to yesterday/last week, which
    # exist in history; tomorrow's lag_1d is today, also in history.
    train = X_all.loc[load.dropna().index].dropna()
    y = load.loc[train.index]
    holdout = train.index >= train.index.max() - pd.Timedelta(days=1)
    mape = None
    if holdout.sum() > 48 and (~holdout).sum() > 96 * 5:
        m = _fit(train[~holdout], y[~holdout], "squared_error")
        p = m.predict(train[holdout])
        actual = y[holdout].values
        mask = actual > 0.5
        mape = float(np.mean(np.abs(p[mask] - actual[mask]) / actual[mask]) * 100) if mask.any() else None

    median = _fit(train, y, "squared_error")
    lo = _fit(train, y, "quantile", 0.1)
    hi = _fit(train, y, "quantile", 0.9)
    Xt = X_all.loc[target].copy()
    Xt[["lag_1d", "lag_7d"]] = Xt[["lag_1d", "lag_7d"]].fillna(float(y.mean()))
    pred = median.predict(Xt[FEATURES])
    lower = np.minimum(lo.predict(Xt[FEATURES]), pred)
    upper = np.maximum(hi.predict(Xt[FEATURES]), pred)
    return ForecastResult("gbr-v1", _points(target, pred, lower, upper), mape, len(train))


def _fit(X: pd.DataFrame, y: pd.Series, loss: str, alpha: float = 0.5) -> GradientBoostingRegressor:
    m = GradientBoostingRegressor(loss=loss, alpha=alpha, n_estimators=200, max_depth=4, learning_rate=0.05, subsample=0.8, random_state=1)
    m.fit(X[FEATURES], y)
    return m


def _points(index, pred, lower, upper) -> list[dict]:
    return [{"t": t.isoformat(), "predicted_kw": round(max(float(p), 0), 2), "lower_kw": round(max(float(lo), 0), 2), "upper_kw": round(max(float(hi), 0), 2)}
            for t, p, lo, hi in zip(index, pred, lower, upper)]


def peak_actions(points: list[dict], limit_kw: float, flexible_kw: float = 0.0) -> list[dict]:
    """Load-shifting recommendations for intervals forecast near or over the limit."""
    out = []
    for p in points:
        over = p["upper_kw"] - limit_kw
        if over > -0.05 * limit_kw:
            t = datetime.fromisoformat(p["t"])
            local = t.astimezone(TZ).strftime("%a %H:%M")
            acts = ["Delay EV charging (scheduler already avoids this interval)"]
            if t.astimezone(TZ).hour >= 12:
                acts.append("Pre-cool booked rooms 1 h earlier, then hold setback")
            acts.append("Stagger dryer starts / lobby HVAC compressor cycling")
            out.append({"t": p["t"], "label": local, "forecast_upper_kw": p["upper_kw"], "limit_kw": limit_kw,
                        "over_kw": round(max(over, 0), 2), "actions": acts})
    return out
