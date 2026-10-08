"""Live weather with graceful fallback: Open-Meteo -> NASA POWER -> district climate averages (offline)."""
import math, time, datetime as dt
import numpy as np
import requests
from .. import config as C

_CACHE = {}
TIMEOUT = 6


def _cached(key, fn, ttl=1800):
    hit = _CACHE.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    val = fn()
    _CACHE[key] = (time.time(), val)
    return val


def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def nearest_district(lat, lon):
    best, bd = None, 1e9
    for name, r in C.DIST.iterrows():
        d = haversine(lat, lon, r.lat, r.lon)
        if d < bd:
            best, bd = name, d
    return best, round(bd, 1)


def _openmeteo(lat, lon):
    r = requests.get("https://api.open-meteo.com/v1/forecast", timeout=TIMEOUT, params={
        "latitude": lat, "longitude": lon, "daily": "precipitation_sum,temperature_2m_mean",
        "past_days": 90, "forecast_days": 3, "timezone": "auto"})
    r.raise_for_status()
    d = r.json()["daily"]
    p = [x or 0.0 for x in d["precipitation_sum"]]
    t = [x for x in d["temperature_2m_mean"][:90] if x is not None]
    return {"source": "open-meteo", "rain30": round(sum(p[60:90]), 1), "rain90": round(sum(p[:90]), 1),
            "rain48": round(sum(p[90:92]), 1), "temp": round(float(np.mean(t[-30:])), 1)}


def _nasa(lat, lon):
    end = dt.date.today() - dt.timedelta(days=2)
    start = end - dt.timedelta(days=89)
    r = requests.get("https://power.larc.nasa.gov/api/temporal/daily/point", timeout=TIMEOUT + 6, params={
        "parameters": "PRECTOTCORR,T2M", "community": "AG", "longitude": lon, "latitude": lat,
        "start": start.strftime("%Y%m%d"), "end": end.strftime("%Y%m%d"), "format": "JSON"})
    r.raise_for_status()
    par = r.json()["properties"]["parameter"]
    p = [v for v in par["PRECTOTCORR"].values() if v > -900]
    t = [v for v in par["T2M"].values() if v > -900]
    return {"source": "nasa-power", "rain30": round(sum(p[-30:]), 1), "rain90": round(sum(p), 1),
            "rain48": 0.0, "temp": round(float(np.mean(t[-30:])), 1)}


def district_average(district):
    """Offline fallback built from the 10-year monthly table for this district."""
    m = dt.date.today().month
    w = C.WEATHER_MONTHLY[C.WEATHER_MONTHLY.district == district]
    cur = w[w.month == m]
    prev3 = [((m - 1 - k) % 12) + 1 for k in range(3)]
    return {"source": "district-average (offline)", "rain30": round(float(cur.rain_mm.mean()), 1),
            "rain90": round(float(w[w.month.isin(prev3)].groupby("year").rain_mm.sum().mean()), 1),
            "rain48": 0.0, "temp": round(float(cur.mean_temp_c.mean()), 1)}


def get_weather(lat, lon, district):
    key = (round(lat, 2), round(lon, 2))
    def go():
        for fn in (_openmeteo, _nasa):
            try:
                return fn(lat, lon)
            except Exception:
                continue
        return district_average(district)
    return _cached(key, go)
