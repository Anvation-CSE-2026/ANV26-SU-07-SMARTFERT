"""Over-application / leaching risk, loop-back, and the sustainability score."""
from .. import config as C

STATUS_BANDS = [(70, "good"), (50, "moderate"), (0, "poor")]


def leach_risk(rain30, texture, rain48, anom):
    return min(1.0, rain30 / 250 + (texture == "sandy") * 0.3 + (rain48 > 50) * 0.3 + max(anom, 0) * 0.05)


def risk_score(dose, cap, rating, leach):
    over = max((dose[n] / cap[n]) for n in C.NUT)                      # how close to the crop cap
    soil_high = sum(r == "high" for r in rating.values()) / 3          # nutrients already high in soil
    s = C.RISK["w_over_ratio"] * over + C.RISK["w_leach_risk"] * leach + C.RISK["w_soil_high"] * soil_high
    return float(min(1.0, s))


def loop_back(dose, cap, rating, leach):
    """If risk > limit, lower the dose 10% and re-check, up to max_tries; otherwise warn."""
    limit, max_tries = C.RISK["risk_limit"], int(C.RISK["max_tries"])
    scale, tries = 1.0, 0
    risk = risk_score(dose, cap, rating, leach)
    while risk > limit and tries < max_tries:
        scale *= 0.9
        tries += 1
        risk = risk_score({n: v * scale for n, v in dose.items()}, cap, rating, leach)
    return {"scale": scale, "tries": tries, "risk": risk, "warning": bool(risk > limit), "limit": limit}


def plan_runoff_index(items, supply_kg):
    """Nutrient-weighted average runoff/leaching risk of the fertilizers in the plan (0..1, from the fertilizer table)."""
    num = den = 0.0
    for it in items:
        f = C.FERTS.loc[it["fertilizer"]]
        nutrient_kg = it["kg_per_ha"] * (f.N_pct + f.P2O5_pct + f.K2O_pct) / 100
        num += nutrient_kg * f.runoff_risk
        den += nutrient_kg
    return num / den if den > 0 else 0.0


def sustainability(crop, target, supply, items, soil, cost, cost_ref, dose_risk):
    """Two numbers, because cost and environment pull in different directions:
       score          (environmental) = 100*(w_r*(1-risk_env) + w_n*NUE_score), weights renormalised from risk_weights.csv
       balanced_score (pitched 3-term) = 100*(0.5*(1-risk_env) + 0.3*NUE_score + 0.2*cost_efficiency)
       risk_env = 0.4*over-application/leaching risk + 0.3*fertilizer runoff index + 0.3*GHG index
       NUE      = fertilizer-derived crop need at target yield / nutrient applied (scored vs nue_good_threshold)
       surplus  = nutrient supplied beyond what the crop needs after normal efficiency losses."""
    c = C.CROPS.loc[crop]
    up = {"N": c.uptake_N_per_t, "P": c.uptake_P2O5_per_t, "K": c.uptake_K2O_per_t}
    se = {"N": c.soil_supply_efficiency_N, "P": c.soil_supply_efficiency_P2O5, "K": c.soil_supply_efficiency_K2O}
    fe = {"N": c.fert_use_efficiency_N, "P": c.fert_use_efficiency_P2O5, "K": c.fert_use_efficiency_K2O}
    need = {n: max(0.0, up[n] * target - soil[n] * se[n] * (2 if n == "P" else 1)) for n in C.NUT}
    applied = sum(supply[n] for n in C.NUT)
    used = sum(min(supply[n], need[n]) for n in C.NUT)
    surplus = sum(max(0.0, supply[n] - need[n] / fe[n]) for n in C.NUT)
    nue = used / applied if applied > 0 else 1.0
    nue_score = min(1.0, nue / C.SUST["nue_good_threshold"])
    chem_N = sum(it["kg_per_ha"] * C.FERTS.loc[it["fertilizer"], "N_pct"] / 100 for it in items
                 if C.FERTS.loc[it["fertilizer"], "type"] != "organic")
    per_kgN = C.SUST["ghg_factor_N2O_kg_per_kg_N"] * 44 / 28 * 273 + C.SUST["co2e_per_kg_N_manufacture"]   # VERIFY factors
    ghg = supply["N"] * C.SUST["ghg_factor_N2O_kg_per_kg_N"] * 44 / 28 * 273 + chem_N * C.SUST["co2e_per_kg_N_manufacture"]
    ghg_ref = c.cap_N_kg_ha * per_kgN                                      # emissions if the full N cap were applied as chemical N
    ghg_idx = min(1.0, ghg / ghg_ref) if ghg_ref > 0 else 0.0
    runoff = plan_runoff_index(items, supply)
    risk_env = 0.4 * dose_risk + 0.3 * runoff + 0.3 * ghg_idx
    cost_eff = max(0.0, min(1.0, 1 - cost / cost_ref)) if cost_ref > 0 else 1.0
    wr, wn, wc = C.RISK["sus_w_risk"], C.RISK["sus_w_nue"], C.RISK["sus_w_cost"]
    score = 100 * (wr * (1 - risk_env) + wn * nue_score) / (wr + wn)
    balanced = 100 * (wr * (1 - risk_env) + wn * nue_score + wc * cost_eff)
    band = next(name for lo, name in STATUS_BANDS if score >= lo)
    return {"score": round(score), "band": band, "balanced_score": round(balanced),
            "nutrient_use_efficiency": round(nue, 2), "surplus_kg_ha": round(surplus, 1),
            "surplus_alert": bool(surplus > C.SUST["surplus_alert_kg_ha"]), "ghg_kg_co2e_ha": round(ghg),
            "plan_runoff_index": round(runoff, 2), "ghg_index": round(ghg_idx, 2), "combined_risk": round(risk_env, 2),
            "cost_efficiency": round(cost_eff, 2)}
