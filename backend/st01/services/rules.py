"""Rule layer: soil rating, nutrient-balance dose (STCR-style), weather/trend rule engine with bounded adjustment."""
import operator
from .. import config as C

OPS = {">": operator.gt, "<": operator.lt, ">=": operator.ge, "<=": operator.le, "==": operator.eq}
ADJ_MAX = 0.20   # a rule-based adjustment can never raise a dose by more than +20%


def rate(n, v):
    lo, hi = C.CUT[n]
    return "low" if v < lo else "high" if v > hi else "medium"


def rate_all(soil):
    return {n: rate(n, soil[n]) for n in C.NUT}


def base_dose(crop, target, soil, rating):
    """need = uptake * target_yield - soil_supply * efficiency ; dose = need / fertilizer_efficiency (clamped later)."""
    c = C.CROPS.loc[crop]
    up = {"N": c.uptake_N_per_t, "P": c.uptake_P2O5_per_t, "K": c.uptake_K2O_per_t}
    fe = {"N": c.fert_use_efficiency_N, "P": c.fert_use_efficiency_P2O5, "K": c.fert_use_efficiency_K2O}
    se = {"N": c.soil_supply_efficiency_N, "P": c.soil_supply_efficiency_P2O5, "K": c.soil_supply_efficiency_K2O}
    out, trace = {}, []
    for n in C.NUT:
        if rating[n] == "high":
            out[n] = 0.0
            trace.append({"nutrient": n, "step": "skip", "detail": f"{n} soil level is HIGH, so no {n} applied."})
            continue
        # P test value is Olsen-P (kg/ha) -> x2 to approximate total soil supply (assumption)
        supply = soil[n] * se[n] * (2 if n == "P" else 1)
        need = max(0.0, up[n] * target - supply)
        d = need / fe[n]
        if rating[n] == "medium":
            d *= 0.5
        if c.legume and n == "N":
            d *= 0.4
        out[n] = d
        trace.append({"nutrient": n, "step": "balance",
                      "detail": f"uptake {up[n]*target:.0f} - soil supply {supply:.0f} = need {need:.0f} kg/ha; "
                                f"/ efficiency {fe[n]:.2f} -> {d:.0f} kg/ha"})
    return out, trace


def _num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return x


def _severity(value, thr):
    """How far past the trigger? 0.5 at the threshold, up to 1.0 when far past it. Categorical rules -> 1.0."""
    if isinstance(value, str) or isinstance(thr, str):
        return 1.0
    return min(1.0, 0.5 + abs(value - thr) / max(abs(thr), 1.0))


def apply_weather_rules(dose, features):
    """adj[n] = clip(sum(sensitivity*severity), 0, ADJ_MAX); dose_new = dose*(1+adj). Returns new dose, trace, advice, defer flag."""
    adj = {n: 0.0 for n in C.NUT}
    trace, advice, defer = [], [], False
    for _, r in C.RULES.iterrows():
        f = r["feature"]
        if f not in features or features[f] is None:
            continue
        thr, val = _num(r["threshold"]), features[f]
        if not OPS[r["operator"]](val, thr):
            continue
        sens, sev = float(r["sensitivity_adjust"]), _severity(val, thr)
        targets = C.NUT if r["nutrient"] == "ALL" else [r["nutrient"]]
        eff = sens * sev
        for n in targets:
            adj[n] += eff
        trace.append({"rule": f"{f} {r['operator']} {r['threshold']}", "nutrient": r["nutrient"],
                      "reason": r["reason"], "effect_pct": round(eff * 100, 1), "advice": r["advice"]})
        advice.append(r["advice"])
        if r["nutrient"] == "ALL" and "DO NOT" in r["advice"]:
            defer = True
    out, applied = {}, {}
    for n in C.NUT:
        a = min(max(adj[n], 0.0), ADJ_MAX)
        applied[n] = round(a * 100, 1)
        out[n] = dose[n] * (1 + a)
    return out, applied, trace, list(dict.fromkeys(advice)), defer


def clamp_to_caps(crop, dose, rating):
    """min-dose rule (avoid soil mining) and max cap (avoid over-application)."""
    c = C.CROPS.loc[crop]
    cap = {"N": c.cap_N_kg_ha, "P": c.cap_P2O5_kg_ha, "K": c.cap_K2O_kg_ha}
    mn = {"N": c.min_N_kg_ha, "P": c.min_P2O5_kg_ha, "K": c.min_K2O_kg_ha}
    out = {}
    for n in C.NUT:
        if rating[n] == "high" or dose[n] <= 0:
            out[n] = 0.0
            continue
        out[n] = float(min(max(dose[n], mn[n]), cap[n]))
    return out, cap
