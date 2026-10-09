"""The full ST-01 pipeline (S1..S12). Report wins over weather prediction; every output is an estimate/range, never a guarantee."""
import datetime as dt
from . import config as C
from .services import rules, risk as R, optimizer, trends, weather, soil, wording, confidence, adaptive
from .services.ml import registry

DISCLAIMER = ("Estimates and ranges only, not guaranteed yield. Values are based on synthetic/assumed parameters for this prototype; "
              "confirm with a soil lab and local agronomy advice. A high-risk warning is not a statement about food safety.")


class InputError(ValueError):
    pass


# ---------------- S1: validate ----------------
def normalize(p):
    def num(k, lo, hi, required=False):
        v = p.get(k)
        if v in (None, ""):
            if required:
                raise InputError(f"missing field: {k}")
            return None
        try:
            v = float(v)
        except (TypeError, ValueError):
            raise InputError(f"{k} must be a number")
        if not lo <= v <= hi:
            raise InputError(f"{k} must be between {lo} and {hi}")
        return v

    crop = p.get("crop")
    if crop not in C.CROPS.index:
        raise InputError(f"unknown crop '{crop}'. Supported: {', '.join(C.CROPS.index)}")
    inp = {"crop": crop, "N": num("N", 0, 1500, True), "P": num("P", 0, 300, True), "K": num("K", 0, 1500, True),
           "pH": num("pH", 3, 10), "OC": num("OC", 0, 5), "rain30": num("rain30", 0, 1500), "rain90": num("rain90", 0, 4000),
           "rain48": num("rain48", 0, 1000), "temp": num("temp", -10, 50), "target": num("target", 0.1, 200),
           "lat": num("lat", -90, 90), "lon": num("lon", -180, 180)}
    tex = p.get("texture")
    if tex not in (None, "") and tex not in C.TEXTURES:
        raise InputError(f"texture must be one of {C.TEXTURES}")
    inp["texture"] = tex or None
    inp["district"] = p.get("district") or None
    if inp["district"] and inp["district"] not in C.DIST.index:
        raise InputError(f"unknown district '{inp['district']}'")
    if not inp["district"] and (inp["lat"] is None or inp["lon"] is None):
        raise InputError("provide a district, or lat and lon")
    obj = p.get("objective", "cheapest")
    if obj not in ("cheapest", "balanced_inm", "eco_inm"):
        raise InputError("objective must be cheapest, balanced_inm or eco_inm")
    inp["objective"] = obj
    ov = {}
    for k, f in (("dap_change", "DAP"), ("urea_change", "Urea")):
        if p.get(k) not in (None, ""):
            ov[f] = float(p[k])
    for f, v in (p.get("price_changes") or {}).items():
        ov[f] = float(v)
    inp["price_overrides"] = ov
    inp["language"] = p.get("language")
    inp["polish"] = bool(p.get("polish"))
    return inp


# ---------------- context (location -> weather, soil estimate, trend) ----------------
def resolve_context(inp):
    notes = []
    district, lat, lon = inp["district"], inp["lat"], inp["lon"]
    if district is None:
        district, km = weather.nearest_district(lat, lon)
        if km > 300:
            notes.append(f"Nearest supported district is {district} ({km:.0f} km away); trend data is approximate for your location.")
    if lat is None:
        lat, lon = float(C.DIST.loc[district, "lat"]), float(C.DIST.loc[district, "lon"])
    src = {}
    if inp["rain30"] is None or inp["temp"] is None:
        w = weather.get_weather(lat, lon, district)
        for k in ("rain30", "rain90", "rain48", "temp"):
            if inp[k] is None:
                inp[k] = w[k]
        src["weather"] = w["source"]
    else:
        src["weather"] = "user"
        if inp["rain90"] is None: inp["rain90"] = inp["rain30"] * 2.8
        if inp["rain48"] is None: inp["rain48"] = 0.0
    if inp["rain90"] is None: inp["rain90"] = inp["rain30"] * 2.8
    if inp["rain48"] is None: inp["rain48"] = 0.0
    if inp["texture"] is None or inp["pH"] is None or inp["OC"] is None:
        s = soil.get_soil_estimate(lat, lon, district)
        for k in ("texture", "pH", "OC"):
            if inp[k] is None:
                inp[k] = s[k]
        src["soil_properties"] = s["source"]
    else:
        src["soil_properties"] = "user"
    src["npk"] = "soil report (user)"
    return district, lat, lon, src, notes


def _fmt(t, **kw):
    return C.TEMPLATES[t].format(**kw)


def _band(d):
    return [round(d * (1 - C.DOSE_UNCERTAINTY)), round(d * (1 + C.DOSE_UNCERTAINTY))]


# ---------------- main ----------------
def recommend(payload):
    inp = normalize(payload)
    try:
        soil_report_age_years = float(payload.get("soil_report_age_years")) if payload.get("soil_report_age_years") not in (None, "") else None
    except (TypeError, ValueError):
        soil_report_age_years = None
    ignore_adaptive = bool(payload.get("ignore_adaptive"))
    district, lat, lon, src, notes = resolve_context(inp)
    crop = inp["crop"]
    cr = C.CROPS.loc[crop]
    target = inp["target"] or float(cr.default_target_yield_t_ha)
    soil_v = {"N": inp["N"], "P": inp["P"], "K": inp["K"]}
    month = dt.date.today().month

    trend = trends.climate_trend(district, inp["rain30"], month)
    anom = trend.get("rain_anomaly_z", 0.0)
    rating = rules.rate_all(soil_v)                                        # S2
    prior = registry.early_warning(crop, inp["texture"], inp["rain30"], inp["rain90"], inp["temp"], anom, inp["OC"], inp["pH"])  # S3
    cross = []
    for n in C.NUT:                                                         # report wins
        if prior[n] > 0.6 and rating[n] != "low":
            cross.append(_fmt("conflict", rating=rating[n].upper()) + f" (weather prior for {n}: {prior[n]})")
        elif prior[n] < 0.2 and rating[n] == "low":
            cross.append(f"Weather did not flag {n}, but your soil report shows LOW; we followed your soil report.")

    out = {"location": {"district": district, "lat": lat, "lon": lon}, "crop": crop, "target_yield_t_ha": target,
           "data_sources": src,
           "resolved_inputs": {"texture": inp["texture"], "pH": inp["pH"], "OC": inp["OC"], "rain30": inp["rain30"],
                               "rain90": inp["rain90"], "rain48": inp["rain48"], "temp": inp["temp"]},
           "soil_rating": rating, "early_warning_prior": prior, "cross_check_notes": cross + notes,
           "climate_trend": trend, "disclaimer": DISCLAIMER}

    # ---------------- S4: no deficiency branch ----------------
    if all(r != "low" for r in rating.values()):
        y = registry.predict_yield(crop, inp["texture"], soil_v, inp["OC"], inp["pH"], {}, inp["rain90"], inp["temp"], anom, explain=True)
        why = [_fmt("no_def", crop=crop)] + [_fmt("high_soil", nutrient=n) for n in C.NUT if rating[n] == "high"]
        conf = confidence.compute(inp, rating, prior, y, src, soil_report_age_years=soil_report_age_years)
        out.update(no_deficiency=True, message=why[0], dose={}, plan=None, alternatives={}, price_signals={},
                   yield_estimate=_yield_block(y, None), risk={"score": 0.05, "warning": False},
                   sustainability={"score": 95, "band": "good", "note": "No fertilizer applied, so no surplus or emissions from inputs."},
                   confidence=conf, adaptive={"applied": False, "available": False, "n_reports": 0}, why=why, rule_trace=[], advice=[])
        return _finish(out, inp)

    # ---------------- S5: nutrient balance, S6: weather + trend adjustment ----------------
    base, trace = rules.base_dose(crop, target, soil_v, rating)
    feats = {"rain_30d_mm": inp["rain30"], "rain_anomaly_z": anom, "temp_30d_c": inp["temp"], "soil_texture": inp["texture"],
             "pH": inp["pH"], "trend_rain_sen_slope": trend["rain_sen_slope_mm_per_yr"], "rain_forecast_48h_mm": inp["rain48"]}
    adjusted, adj_pct, fired, advice, defer = rules.apply_weather_rules(base, feats)
    dose, cap = rules.clamp_to_caps(crop, adjusted, rating)

    # ---------------- S8: risk + loop-back ----------------
    leach = R.leach_risk(inp["rain30"], inp["texture"], inp["rain48"], anom)
    lb = R.loop_back(dose, cap, rating, leach)
    dose = {n: v * lb["scale"] for n, v in dose.items()}

    # ---------------- adaptive feedback-loop learning (bounded, optional) ----------------
    # Nudges the dose toward what verified local reports say actually happened -
    # never above the crop cap, never without >= min_verified_reports_for_yield
    # reports for the yield side, and the farmer can always switch it off.
    calib_row = adaptive.get_calibration(crop, district)
    adaptive_meta = adaptive.build_meta(calib_row, ignore_adaptive)
    if calib_row and not ignore_adaptive:
        mult = {"N": calib_row.dose_mult_N, "P": calib_row.dose_mult_P, "K": calib_row.dose_mult_K}
        dose = {n: float(min(dose[n] * mult[n], cap[n])) for n in C.NUT}

    # ---------------- S7: cost optimisation + price trend ----------------
    price_now = optimizer.prices(inp["price_overrides"])
    sig = trends.price_signals(list(C.PRICES.fertilizer.unique()))
    price_fc = optimizer.prices(inp["price_overrides"], sig)
    plans = optimizer.build_plans(dose, price_now, price_fc)
    chosen_name = inp["objective"] if inp["objective"] in plans else "cheapest"
    chosen = plans[chosen_name]
    ref = optimizer.cheapest_plan({n: cap[n] for n in C.NUT}, price_now)["cost"]

    # ---------------- S9: yield range + sustainability ----------------
    supply = chosen["supply"]
    y = registry.predict_yield(crop, inp["texture"], soil_v, inp["OC"], inp["pH"], supply, inp["rain90"], inp["temp"], anom, explain=True)
    y0 = registry.predict_yield(crop, inp["texture"], soil_v, inp["OC"], inp["pH"], {}, inp["rain90"], inp["temp"], anom)
    if calib_row and not ignore_adaptive and adaptive.yield_bias_active(calib_row):
        yfactor = 1 + calib_row.yield_bias / 100
        y = {**y, "low": y["low"] * yfactor, "point": y["point"] * yfactor, "high": y["high"] * yfactor}
    whatif = {}
    for label, mult in (("N dose -20%", 0.8), ("N dose +20%", 1.2)):
        s2 = dict(supply); s2["N"] = supply["N"] * mult
        whatif[label] = round(registry.predict_yield(crop, inp["texture"], soil_v, inp["OC"], inp["pH"], s2, inp["rain90"], inp["temp"], anom)["point"], 2)
    sus = R.sustainability(crop, target, supply, chosen["items"], soil_v, chosen["cost"], ref, lb["risk"])
    for name in ("cheapest", "balanced_inm", "eco_inm"):
        if name in plans:
            s_ = R.sustainability(crop, target, plans[name]["supply"], plans[name]["items"], soil_v, plans[name]["cost"], ref, lb["risk"])
            plans[name]["sustainability_score"] = s_["score"]
            plans[name]["balanced_score"] = s_["balanced_score"]
            plans[name]["ghg_kg_co2e_ha"] = s_["ghg_kg_co2e_ha"]

    # ---------------- S10: explanation ----------------
    why = []
    for n in C.NUT:
        if rating[n] == "high":
            why.append(_fmt("high_soil", nutrient=n))
        elif rating[n] == "low":
            lo, hi = _band(dose[n])
            need = round(float(cr[{"N": "uptake_N_per_t", "P": "uptake_P2O5_per_t", "K": "uptake_K2O_per_t"}[n]]) * target)
            why.append(_fmt(f"low_{n}", N=inp["N"], P=inp["P"], K=inp["K"], crop=crop, need=need, dose_range=f"{lo}-{hi}"))
        else:
            lo, hi = _band(dose[n]); why.append(f"{n} is MEDIUM, so only a maintenance dose of {lo}-{hi} kg/ha is suggested.")
    if adj_pct["N"] > 0:
        why.append(_fmt("weather_up", pct=adj_pct["N"]))
    if inp["rain48"] > 50:
        why.append(_fmt("rain_warn"))
    if lb["tries"]:
        why.append(f"Risk was above the limit, so the dose was lowered {round((1 - lb['scale']) * 100)}% ({lb['tries']} loop-back).")
    if lb["warning"]:
        why.append(_fmt("risk_warn"))
    pa = plans.get("price_alternative")
    if pa:
        now_set = {i["fertilizer"] for i in plans["cheapest"]["items"]}
        alt_set = {i["fertilizer"] for i in pa["items"]}
        why.append(_fmt("price_alt", fert=", ".join(sorted(now_set - alt_set)) or "current mix",
                        alt=", ".join(sorted(alt_set - now_set)) or "the alternative mix", saving=pa["saving_rs_per_ha"]))
    if adaptive_meta["applied"]:
        why.append(adaptive_meta["message"])

    # Once enough verified local reports exist, they can lift the honesty cap
    # on the confidence score too (see confidence.py) - a handful of reports
    # barely move it; min_verified_reports_for_yield+ worth is a full signal.
    feedback_support = min(1.0, calib_row.n_reports / 20) if calib_row and calib_row.n_reports > 0 else None
    conf = confidence.compute(inp, rating, prior, y, src, soil_report_age_years=soil_report_age_years, feedback_support=feedback_support)

    out.update(no_deficiency=False,
               dose={n: {"point": round(dose[n], 1), "low": round(dose[n] * (1 - C.DOSE_UNCERTAINTY), 1),
                         "high": round(dose[n] * (1 + C.DOSE_UNCERTAINTY), 1), "cap": float(cap[n]),
                         "weather_adjustment_pct": adj_pct[n]} for n in C.NUT},
               plan={"objective": chosen_name, **chosen}, alternatives={k: v for k, v in plans.items() if k != "price_alternative" and k != chosen_name},
               price_alternative=pa, price_signals={f: {"direction": s["direction"], "change_pct": s["change_pct"]} for f, s in sig.items()},
               defer_application=defer, advice=advice,
               yield_estimate=_yield_block(y, y0, whatif),
               risk={"score": round(lb["risk"], 2), "limit": lb["limit"], "loop_back_tries": lb["tries"], "warning": lb["warning"],
                     "text": _fmt("risk_warn") if lb["warning"] else None, "leach_component": round(leach, 2)},
               sustainability=sus, confidence=conf, adaptive=adaptive_meta, why=why,
               rule_trace={"balance": trace, "weather_and_trend_rules": fired})
    return _finish(out, inp)


def _yield_block(y, y0, whatif=None):
    b = {"low_t_ha": round(y["low"], 2), "point_t_ha": round(y["point"], 2), "high_t_ha": round(y["high"], 2),
         "interval": f"{int(C.INTERVAL_COVERAGE*100)}% conformal prediction interval", "drivers": y.get("drivers", [])}
    if y0:
        b["without_fertilizer_t_ha"] = round(y0["point"], 2)
        b["expected_gain_t_ha"] = round(y["point"] - y0["point"], 2)
    if whatif:
        b["what_if_point_t_ha"] = whatif
    return b


def _finish(out, inp):
    if inp.get("polish"):
        lines, ok = wording.polish(out["why"], inp.get("language") or "simple English")
        out["why_polished"] = lines if ok else None
        out["polished_by_llm"] = ok
    return out


# ---------------- crop recommendation ----------------
def crop_recommend(p):
    for k in ("N", "P", "K"):
        if p.get(k) in (None, ""):
            raise InputError(f"missing field: {k}")
    d = p.get("district")
    if d not in C.DIST.index:
        raise InputError("unknown or missing district")
    row = C.DIST.loc[d]
    top = registry.recommend_crops(float(p["N"]), float(p["P"]), float(p["K"]),
                                   float(p.get("temp") or row.mean_temp_c), float(p.get("humidity") or 65),
                                   float(p.get("rainfall") or row.mean_annual_rain_mm), float(p.get("pH") or 7.0))
    return {"district": d, "top_crops": top, "note": "Trained on synthetic agro-climatic ranges; use as a suggestion only."}
