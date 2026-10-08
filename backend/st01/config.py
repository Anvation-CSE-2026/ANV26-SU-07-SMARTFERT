"""Loads every config / lookup table from CSV so rules are editable without touching code.
All values in ./data are SYNTHETIC or ASSUMPTIONS: verify with ICAR / Soil Health Card / state university guidance."""
import os
import pandas as pd

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.environ.get("ST01_DATA", os.path.join(BASE, "data"))
MODELS_DIR = os.environ.get("ST01_MODELS", os.path.join(BASE, "models"))


def csv(name, **kw):
    return pd.read_csv(os.path.join(DATA, name), **kw)


CROPS = csv("crop_requirements.csv").set_index("crop")
FERTS = csv("fertilizer_table.csv").set_index("fertilizer")
DIST = csv("districts.csv").set_index("district")
SCEN = csv("demo_scenarios.csv")
RULES = csv("nutrient_weather_rules.csv", dtype=str)
WEATHER_MONTHLY = csv("weather_monthly_10yr.csv")
PRICES = csv("fertilizer_price_series.csv", parse_dates=["month"])
RISK = csv("risk_weights.csv").set_index("name")["value"].astype(float).to_dict()
SUST = csv("sustainability_params.csv").set_index("parameter")["value"].astype(float).to_dict()
TEMPLATES = csv("reason_templates.csv").set_index("template_id")["text"].to_dict()
CONF_WEIGHTS = csv("confidence_weights.csv").set_index("name")["value"].astype(float).to_dict()
INPUT_PCTL = csv("input_percentiles.csv").set_index("feature")[["p5", "p95"]].astype(float).to_dict(orient="index")
SEASONS = csv("seasons.csv").set_index("season")[["start_month", "end_month"]].astype(int).to_dict(orient="index")

_th = csv("soil_rating_thresholds.csv").set_index("parameter")
CUT = {"N": (float(_th.loc["N_kg_ha", "low_below"]), float(_th.loc["N_kg_ha", "high_above"])),
       "P": (float(_th.loc["P_kg_ha", "low_below"]), float(_th.loc["P_kg_ha", "high_above"])),
       "K": (float(_th.loc["K_kg_ha", "low_below"]), float(_th.loc["K_kg_ha", "high_above"]))}

NUT = ["N", "P", "K"]
FERT_COL = {"N": "N_pct", "P": "P2O5_pct", "K": "K2O_pct"}
TEXTURES = ["sandy", "loam", "clay"]
TEXTURE_OF_SOIL = {"alluvial clay": "clay", "alluvial loam": "loam", "sandy loam": "sandy", "red loam": "loam",
                   "red sandy loam": "sandy", "black clay": "clay", "medium black": "clay",
                   "black cotton": "clay", "alluvial": "loam"}

ORGANIC_NAME = "Vermicompost"      # used in the INM (integrated nutrient management) plans
ORGANIC_AVAILABILITY = 0.5         # fraction of organic nutrients available in the first season (assumption)
INTERVAL_COVERAGE = 0.80           # conformal prediction interval coverage
DOSE_UNCERTAINTY = 0.15            # +/- band shown around a point dose


def _flag(name, default="false"):
    return os.environ.get(name, default).strip().lower() in ("1", "true", "yes", "on")


# ---------------- feature flags (env) ----------------
# Each gated feature must degrade gracefully (clear "not available" response) when its
# flag, key or network dependency is missing - it must never crash the request.
# History/Feedback are local-only (no external key or network dependency), so they
# default ON; Chat and Satellite call out to paid/keyed services, so they default OFF
# until an operator deliberately turns them on (and supplies the matching keys).
FEATURE_FEEDBACK = _flag("FEATURE_FEEDBACK", default="true")
FEATURE_HISTORY = _flag("FEATURE_HISTORY", default="true")
FEATURE_CHAT = _flag("FEATURE_CHAT")
FEATURE_SATELLITE = _flag("FEATURE_SATELLITE")
SAT_PROVIDER = os.environ.get("SAT_PROVIDER", "demo").strip().lower()  # demo|copernicus|earthengine|planetary

# ---------------- database ----------------
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///" + os.path.join(BASE, "st01.db"))

# ---------------- admin ----------------
ADMIN_TOKEN = os.environ.get("ST01_ADMIN_TOKEN")  # required to call /api/admin/* endpoints; unset = disabled
