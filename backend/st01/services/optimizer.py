"""Cost optimisation: linear programming over fertilizers (cost per kg nutrient), price-trend alternatives,
integrated nutrient management (INM) plans that trade a bit of cost for sustainability."""
import numpy as np
from scipy.optimize import linprog
from .. import config as C

OVERSHOOT = 1.10   # never supply more than 110% of the dose (this is what prevents over-application)


def _chemicals():
    f = C.FERTS
    return [n for n in f.index if f.loc[n, "type"] in ("chemical", "slow-release")
            and f.loc[n, ["N_pct", "P2O5_pct", "K2O_pct"]].sum() > 0]


def prices(overrides_pct=None, forecast=None):
    """Price per kg for every fertilizer, with optional % overrides (user input) and a forecast multiplier."""
    p = {f: float(C.FERTS.loc[f, "price_rs_per_kg"]) for f in C.FERTS.index}
    for f, pct in (overrides_pct or {}).items():
        if f in p:
            p[f] *= 1 + pct / 100
    for f, sig in (forecast or {}).items():
        if f in p:
            p[f] *= 1 + sig["change_pct"] / 100
    return p


def cheapest_plan(dose, price):
    """min sum(price*x)  s.t.  dose <= supply <= 1.10*dose per nutrient, x >= 0."""
    names = _chemicals()
    cost = [price[f] for f in names]
    A, b = [], []
    for n in C.NUT:
        if dose.get(n, 0) > 0:
            row = [C.FERTS.loc[f, C.FERT_COL[n]] / 100 for f in names]
            A.append([-x for x in row]); b.append(-dose[n])
            A.append(row); b.append(dose[n] * OVERSHOOT)
    if not A:
        return {"items": [], "cost": 0.0, "supply": {n: 0.0 for n in C.NUT}, "feasible": True}
    r = linprog(cost, A_ub=A, b_ub=b, bounds=[(0, None)] * len(names), method="highs")
    if not r.success:   # fall back to relaxed upper bound
        A2 = [a for i, a in enumerate(A) if i % 2 == 0]; b2 = [v for i, v in enumerate(b) if i % 2 == 0]
        r = linprog(cost, A_ub=A2, b_ub=b2, bounds=[(0, None)] * len(names), method="highs")
    items = [{"fertilizer": names[i], "kg_per_ha": round(float(r.x[i]), 1), "cost_rs": round(float(r.x[i] * cost[i]))}
             for i in range(len(names)) if r.x[i] > 0.5]
    supply = {n: sum(it["kg_per_ha"] * C.FERTS.loc[it["fertilizer"], C.FERT_COL[n]] / 100 for it in items) for n in C.NUT}
    return {"items": items, "cost": round(float(r.fun), 0), "supply": {n: round(v, 1) for n, v in supply.items()}, "feasible": True}


def inm_plan(dose, price, organic_share):
    """Replace `organic_share` of the N dose with vermicompost (50% first-season availability) and cover the rest chemically."""
    org = C.ORGANIC_NAME
    if dose.get("N", 0) <= 0 or organic_share <= 0:
        return None
    pct = {n: C.FERTS.loc[org, C.FERT_COL[n]] / 100 * C.ORGANIC_AVAILABILITY for n in C.NUT}
    q = organic_share * dose["N"] / pct["N"]
    credit = {n: q * pct[n] for n in C.NUT}
    rest = {n: max(0.0, dose.get(n, 0) - credit[n]) for n in C.NUT}
    chem = cheapest_plan(rest, price)
    items = [{"fertilizer": org, "kg_per_ha": round(q, 1), "cost_rs": round(q * price[org])}] + chem["items"]
    supply = {n: round(chem["supply"][n] + credit[n], 1) for n in C.NUT}
    return {"items": items, "cost": round(chem["cost"] + q * price[org]), "supply": supply, "feasible": True}


def build_plans(dose, price_now, price_forecast):
    plans = {"cheapest": cheapest_plan(dose, price_now)}
    bal, eco = inm_plan(dose, price_now, 0.25), inm_plan(dose, price_now, 0.40)
    if bal: plans["balanced_inm"] = bal
    if eco: plans["eco_inm"] = eco
    fc = cheapest_plan(dose, price_forecast)
    # compare composition of today's cheapest vs plan under forecast prices
    now_set = {i["fertilizer"] for i in plans["cheapest"]["items"]}
    fc_set = {i["fertilizer"] for i in fc["items"]}
    now_under_fc = sum(i["kg_per_ha"] * price_forecast[i["fertilizer"]] for i in plans["cheapest"]["items"])
    plans["price_alternative"] = None
    if now_set != fc_set and now_under_fc - fc["cost"] > 50:
        plans["price_alternative"] = {"items": fc["items"], "cost_at_forecast_prices": fc["cost"],
                                      "current_plan_cost_at_forecast_prices": round(now_under_fc),
                                      "saving_rs_per_ha": round(now_under_fc - fc["cost"])}
    return plans
