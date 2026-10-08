"""Trend analysis: climate trend (Mann-Kendall + Sen's slope), anomaly z-score, CUSUM, fertilizer price forecast (Holt-Winters)."""
import warnings
import numpy as np
import pandas as pd
import pymannkendall as mk
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from .. import config as C

warnings.filterwarnings("ignore")


def cusum_alarm(series, k=0.5, h=4.0):
    """Simple two-sided CUSUM on standardised values; True if a sustained shift is detected."""
    x = np.asarray(series, float)
    if len(x) < 5 or x.std() == 0:
        return False
    z = (x - x.mean()) / x.std()
    pos = neg = 0.0
    for v in z:
        pos, neg = max(0, pos + v - k), max(0, neg - v - k)
        if pos > h or neg > h:
            return True
    return False


def climate_trend(district, rain30=None, month=None):
    w = C.WEATHER_MONTHLY[C.WEATHER_MONTHLY.district == district]
    annual = w.groupby("year").rain_mm.sum()
    temp = w.groupby("year").mean_temp_c.mean()
    r = mk.original_test(annual.values)
    t = mk.original_test(temp.values)
    out = {"years": f"{int(annual.index.min())}-{int(annual.index.max())}",
           "rain_trend": r.trend, "rain_p_value": round(float(r.p), 3), "rain_sen_slope_mm_per_yr": round(float(r.slope), 2),
           "temp_trend": t.trend, "temp_sen_slope_c_per_yr": round(float(t.slope), 3),
           "rain_shift_detected_cusum": bool(cusum_alarm(annual.values))}
    if rain30 is not None and month is not None:
        hist = w[w.month == month].rain_mm
        sd = float(hist.std()) or 1.0
        out["rain_anomaly_z"] = round((float(rain30) - float(hist.mean())) / sd, 2)
    return out


_HW = {}


def price_trend(fertilizer, horizon=3):
    """Forecast next months' price; direction 'rising' if the mean forecast is >5% above the latest price."""
    s = C.PRICES[C.PRICES.fertilizer == fertilizer].sort_values("month")
    if len(s) < 30:
        return None
    key = (fertilizer, horizon)
    if key not in _HW:
        y = s.set_index("month").price_rs_per_kg.asfreq("MS")
        fit = ExponentialSmoothing(y, trend="add", seasonal="add", seasonal_periods=12).fit()
        fc = fit.forecast(horizon)
        _HW[key] = (float(y.iloc[-1]), [round(float(v), 2) for v in fc.values], str(y.index[-1].date()))
    last, fc, last_month = _HW[key]
    pct = (float(np.mean(fc)) - last) / last
    return {"fertilizer": fertilizer, "last_price": round(last, 2), "last_month": last_month, "forecast": fc,
            "change_pct": round(pct * 100, 1), "direction": "rising" if pct > 0.05 else "falling" if pct < -0.05 else "stable"}


def price_signals(fertilizers):
    sig = {}
    for f in fertilizers:
        t = price_trend(f)
        if t:
            sig[f] = t
    return sig
