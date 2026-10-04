from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd

from marq_analytics.forecast import forecast, peak_actions
from marq_analytics.weather import climatology


def synthetic(days: int, end: datetime, noise=1.0, seed=3):
    rng = np.random.default_rng(seed)
    idx = pd.date_range(end - timedelta(days=days), end, freq="15min", tz=timezone.utc, inclusive="left")
    local = idx.tz_convert("America/Toronto")
    h = local.hour + local.minute / 60
    weekend = local.dayofweek >= 5
    load = 30 + 20 * np.exp(-((h - 19.5) ** 2) / 6) + np.where(weekend, 8, 0) + rng.normal(0, noise, len(idx))
    temps = {t.to_pydatetime(): climatology(t.to_pydatetime()) for t in pd.date_range(idx[0].floor("h"), end + timedelta(days=2), freq="h", tz=timezone.utc)}
    return pd.Series(load, index=idx), temps


def test_gbr_learns_daily_and_weekly_shape():
    end = datetime(2026, 10, 5, 4, 0, tzinfo=timezone.utc)  # Monday 00:00 local
    load, temps = synthetic(35, end)
    empty = pd.Series(dtype=float)
    res = forecast(load, temps, empty, empty, end)
    assert res.model == "gbr-v1"
    assert len(res.points) == 96
    pred = np.array([p["predicted_kw"] for p in res.points])
    truth, _ = synthetic(1, end + timedelta(days=1), noise=0, seed=9)
    mape = np.mean(np.abs(pred - truth.values) / truth.values) * 100
    assert mape < 8, mape
    assert res.mape is not None and res.mape < 10
    assert all(p["lower_kw"] <= p["predicted_kw"] <= p["upper_kw"] for p in res.points)
    # Evening peak around 19:30 local.
    peak_local = pd.Timestamp(res.points[int(pred.argmax())]["t"]).tz_convert("America/Toronto")
    assert 18 <= peak_local.hour <= 21


def test_short_history_falls_back_to_seasonal_naive():
    end = datetime(2026, 10, 5, 4, 0, tzinfo=timezone.utc)
    load, temps = synthetic(3, end)
    empty = pd.Series(dtype=float)
    res = forecast(load, temps, empty, empty, end)
    assert res.model == "seasonal-naive" and len(res.points) == 96


def test_peak_actions():
    pts = [{"t": "2026-10-07T22:00:00+00:00", "predicted_kw": 140, "lower_kw": 130, "upper_kw": 152},
           {"t": "2026-10-07T23:00:00+00:00", "predicted_kw": 60, "lower_kw": 50, "upper_kw": 70}]
    acts = peak_actions(pts, 150)
    assert len(acts) == 1 and acts[0]["over_kw"] == 2
