"""Soil estimates from SoilGrids (pH, organic carbon, texture). NOTE: SoilGrids has NO available P or K,
so N/P/K always come from the farmer's soil report (that is why the report is the authority)."""
import requests
from .. import config as C

TIMEOUT = 8


def soilgrids(lat, lon):
    r = requests.get("https://rest.isric.org/soilgrids/v2.0/properties/query", timeout=TIMEOUT, params=[
        ("lon", lon), ("lat", lat), ("property", "phh2o"), ("property", "soc"), ("property", "sand"),
        ("property", "clay"), ("depth", "0-5cm"), ("value", "mean")])
    r.raise_for_status()
    vals = {}
    for layer in r.json()["properties"]["layers"]:
        f = layer["unit_measure"]["d_factor"]
        vals[layer["name"]] = layer["depths"][0]["values"]["mean"] / f
    sand, clay = vals["sand"] / 10, vals["clay"] / 10        # g/kg -> %
    texture = "sandy" if sand > 55 else "clay" if clay > 35 else "loam"
    return {"source": "soilgrids", "pH": round(vals["phh2o"], 2), "OC": round(vals["soc"] / 10, 2),
            "texture": texture}


def district_soil(district):
    tex = C.TEXTURE_OF_SOIL.get(C.DIST.loc[district, "dominant_soil"], "loam")
    oc = {"clay": 0.65, "loam": 0.55, "sandy": 0.40}[tex]
    ph = {"clay": 7.8, "loam": 7.2, "sandy": 6.6}[tex]
    return {"source": "district-default (offline)", "pH": ph, "OC": oc, "texture": tex}


def get_soil_estimate(lat, lon, district):
    try:
        return soilgrids(lat, lon)
    except Exception:
        return district_soil(district)
