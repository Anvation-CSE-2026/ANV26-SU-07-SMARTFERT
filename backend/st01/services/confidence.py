"""Confidence score: a HEURISTIC 0-100 indicator of how much to trust a single recommendation,
not a statistical probability of correctness. Weights are editable in data/confidence_weights.csv.
If a component can't be computed (e.g. no feedback history yet, no satellite data), it is left
out and the remaining weights are renormalised so the score still sums to 100.
"""
from .. import config as C

RATING_DEFICIENCY_PROB = {"low": 1.0, "medium": 0.5, "high": 0.0}


def _clip(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def _data_quality(src, soil_report_age_years):
    npk_quality = 1.0  # N, P, K are always required, user-entered values in this pipeline
    if soil_report_age_years is not None and soil_report_age_years > C.CONF_WEIGHTS["soil_report_age_penalty_years"]:
        # old report: linearly lose credit, floor at 0.5 so an old-but-present report still counts for something
        over = soil_report_age_years - C.CONF_WEIGHTS["soil_report_age_penalty_years"]
        npk_quality = max(0.5, 1.0 - 0.1 * over)
    weather_quality = 1.0 if src.get("weather") == "user" else 0.6
    soil_props_quality = 1.0 if src.get("soil_properties") == "user" else 0.6
    return (npk_quality + weather_quality + soil_props_quality) / 3.0


def _model_agreement(rating, prior):
    agreements = []
    for n in C.NUT:
        expected = RATING_DEFICIENCY_PROB[rating[n]]
        agreements.append(1.0 - abs(expected - prior.get(n, expected)))
    return sum(agreements) / len(agreements)


def _interval_tightness(y):
    if not y or not y.get("point"):
        return None
    point = y["point"]
    if point <= 0:
        return None
    return 1.0 - _clip((y["high"] - y["low"]) / (2 * point))


def _in_distribution(inp):
    checked = [("N_kg_ha", inp.get("N")), ("P_kg_ha", inp.get("P")), ("K_kg_ha", inp.get("K")),
               ("OC_pct", inp.get("OC")), ("pH", inp.get("pH")), ("rain_90d_mm", inp.get("rain90")),
               ("temp_30d_c", inp.get("temp"))]
    inside = total = 0
    for key, v in checked:
        if v is None or key not in C.INPUT_PCTL:
            continue
        total += 1
        band = C.INPUT_PCTL[key]
        if band["p5"] <= v <= band["p95"]:
            inside += 1
    return inside / total if total else None


def compute(inp, rating, prior, y, src, soil_report_age_years=None, feedback_support=None, satellite_agreement=None):
    components = {
        "data_quality": _data_quality(src, soil_report_age_years),
        "model_agreement": _model_agreement(rating, prior),
        "interval_tightness": _interval_tightness(y),
        "in_distribution": _in_distribution(inp),
        "feedback_support": feedback_support,
        "satellite_agreement": satellite_agreement,
    }
    weight_key = {"data_quality": "w_data_quality", "model_agreement": "w_model_agreement",
                  "interval_tightness": "w_interval_tightness", "in_distribution": "w_in_distribution",
                  "feedback_support": "w_feedback_support", "satellite_agreement": "w_satellite_agreement"}

    available = {k: v for k, v in components.items() if v is not None}
    total_weight = sum(C.CONF_WEIGHTS[weight_key[k]] for k in available) or 1.0
    score = 100 * sum(C.CONF_WEIGHTS[weight_key[k]] * v for k, v in available.items()) / total_weight
    score = round(_clip(score, 0, 100))

    band = ("High" if score >= C.CONF_WEIGHTS["band_high_min"]
            else "Medium" if score >= C.CONF_WEIGHTS["band_medium_min"] else "Low")

    reasons, improve = [], []
    dq = components["data_quality"]
    if dq is not None:
        if dq >= 0.9:
            reasons.append("Your N, P and K came from your own soil report, and weather/soil context was live for your location.")
        else:
            reasons.append("Some soil or weather context came from typical values rather than live data for your exact field.")
            improve.append("Share your exact location so we can use live weather and soil context instead of district typical values.")
    ma = components["model_agreement"]
    if ma is not None and ma < 0.6:
        reasons.append("Weather-based early signals did not fully agree with your soil report.")
    it = components["interval_tightness"]
    if it is not None:
        if it < 0.5:
            improve.append("A fresh soil test can narrow the yield estimate's range.")
        else:
            reasons.append("The estimated yield range is reasonably narrow for this crop.")
    ind = components["in_distribution"]
    if ind is not None and ind < 0.8:
        reasons.append("A few of your values are outside the typical range this model was trained on, so treat the estimate with extra care.")
        improve.append("A soil lab test would help confirm whether these unusual readings are accurate.")
    if components["feedback_support"] is None:
        improve.append("Once more farmers nearby share what happened after applying, this estimate can be fine-tuned for your area.")
    if components["satellite_agreement"] is None:
        pass  # only mention satellite once that feature is actually available (honesty rule)
    if soil_report_age_years is not None and soil_report_age_years > C.CONF_WEIGHTS["soil_report_age_penalty_years"]:
        improve.append(f"Your soil report is about {soil_report_age_years:.0f} years old — a fresh test would help.")

    return {
        "score": score,
        "band": band,
        "components": {k: (round(v, 2) if v is not None else None) for k, v in components.items()},
        "reasons": reasons,
        "how_to_improve": improve,
        "note": "This is a heuristic confidence indicator, not a statistical probability of correctness.",
    }
