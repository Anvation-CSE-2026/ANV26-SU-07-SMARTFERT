"""Offline retraining: merges VERIFIED farmer feedback (weighted higher than
the synthetic rows) into the yield model's training data, trains a candidate,
evaluates it against a held-out split of the ORIGINAL data plus the feedback
itself, and only promotes it over the live model if it is not worse. Keeps a
small versioned registry so a bad promotion can be rolled back.

    python scripts/retrain_with_feedback.py            # train, evaluate, promote-or-keep
    python scripts/retrain_with_feedback.py --rollback # restore the previous version

This never touches the early-warning or crop-recommender models - only the
yield regressor, since that's the one farmer-reported actual_yield_t_ha
feedback can actually supervise.
"""
import argparse
import datetime as dt
import json
import os
import shutil
import sys

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from st01 import config as C
from st01.db import db, Feedback, Recommendation
from st01.services.ml import yield_frame

REGISTRY_PATH = os.path.join(C.MODELS_DIR, "registry.json")
FEEDBACK_WEIGHT = 5.0  # a verified real report counts as 5 synthetic rows in the fit


def _load_registry():
    if os.path.exists(REGISTRY_PATH):
        return json.load(open(REGISTRY_PATH))
    return {"versions": []}


def _save_registry(reg):
    json.dump(reg, open(REGISTRY_PATH, "w"), indent=2)


def _backup_current(reg):
    """Copies the live model+metrics to a timestamped pair before overwriting,
    and records it in the registry so --rollback can restore it."""
    ts = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    model_path = os.path.join(C.MODELS_DIR, "models.joblib")
    metrics_path = os.path.join(C.MODELS_DIR, "metrics.json")
    if not os.path.exists(model_path):
        return reg
    backup_model = os.path.join(C.MODELS_DIR, f"models_{ts}.joblib")
    backup_metrics = os.path.join(C.MODELS_DIR, f"metrics_{ts}.json")
    shutil.copy(model_path, backup_model)
    shutil.copy(metrics_path, backup_metrics)
    reg["versions"].append({"timestamp": ts, "model": backup_model, "metrics": backup_metrics})
    _save_registry(reg)
    return reg


def rollback():
    reg = _load_registry()
    if not reg["versions"]:
        print("No previous version to roll back to.")
        return
    last = reg["versions"].pop()
    shutil.copy(last["model"], os.path.join(C.MODELS_DIR, "models.joblib"))
    shutil.copy(last["metrics"], os.path.join(C.MODELS_DIR, "metrics.json"))
    _save_registry(reg)
    print(f"Rolled back to version {last['timestamp']}.")


def _verified_feedback_rows():
    """Reconstructs yield_training.csv-shaped rows from verified feedback -
    the recommendation's own resolved inputs plus what was actually applied
    and what yield actually resulted."""
    rows, weights = [], []
    feedback = Feedback.query.filter_by(verified=True).filter(Feedback.actual_yield_t_ha.isnot(None)).all()
    for fb in feedback:
        rec = db.session.get(Recommendation, fb.rec_id)
        if not rec:
            continue
        inp = rec.inputs_json or {}
        out = rec.output_json or {}
        dose = (out.get("dose") or {})
        if not all(n in dose for n in C.NUT):
            continue
        texture = inp.get("texture") or (out.get("resolved_inputs") or {}).get("texture") or "loam"
        rows.append({
            "crop": rec.crop, "dose_N_kg_ha": dose["N"]["point"], "dose_P2O5_kg_ha": dose["P"]["point"], "dose_K2O_kg_ha": dose["K"]["point"],
            "yield_t_ha": fb.actual_yield_t_ha, "N_kg_ha": inp.get("N"), "P_kg_ha": inp.get("P"), "K_kg_ha": inp.get("K"),
            "OC_pct": inp.get("OC") or 0.5, "pH": inp.get("pH") or 6.8, "rain_90d_mm": inp.get("rain30", 0) * 2.8,
            "temp_30d_c": inp.get("temp") or 27, "rain_anomaly_z": 0.0, "soil_texture": texture,
        })
        weights.append(FEEDBACK_WEIGHT if not fb.simulated else 1.0)  # a real report outweighs a simulated-demo one too
    return pd.DataFrame(rows), np.array(weights)


def retrain_and_maybe_promote(app):
    with app.app_context():
        fb_df, fb_weights = _verified_feedback_rows()

        synthetic = C.csv("yield_training.csv")
        syn_df = pd.DataFrame({"crop": synthetic.crop, "dose_N_kg_ha": synthetic.dose_N_kg_ha, "dose_P2O5_kg_ha": synthetic.dose_P2O5_kg_ha,
                               "dose_K2O_kg_ha": synthetic.dose_K2O_kg_ha, "yield_t_ha": synthetic.yield_t_ha, "N_kg_ha": synthetic.N_kg_ha,
                               "P_kg_ha": synthetic.P_kg_ha, "K_kg_ha": synthetic.K_kg_ha, "OC_pct": synthetic.OC_pct, "pH": synthetic.pH,
                               "rain_90d_mm": synthetic.rain_90d_mm, "temp_30d_c": synthetic.temp_30d_c,
                               "rain_anomaly_z": synthetic.rain_anomaly_z, "soil_texture": synthetic.soil_texture})
        syn_weights = np.ones(len(syn_df))

        combined = pd.concat([syn_df, fb_df], ignore_index=True) if len(fb_df) else syn_df
        weights = np.concatenate([syn_weights, fb_weights]) if len(fb_df) else syn_weights

        df = pd.DataFrame({"crop": combined.crop, "dose_N": combined.dose_N_kg_ha, "dose_P": combined.dose_P2O5_kg_ha,
                           "dose_K": combined.dose_K2O_kg_ha, "N": combined.N_kg_ha, "P": combined.P_kg_ha, "K": combined.K_kg_ha,
                           "OC": combined.OC_pct, "pH": combined.pH, "rain90": combined.rain_90d_mm, "temp": combined.temp_30d_c,
                           "anom": combined.rain_anomaly_z, "soil_texture": combined.soil_texture})
        ratio = (combined.yield_t_ha / C.CROPS.loc[combined.crop].default_target_yield_t_ha.values).values
        X = yield_frame(df)

        Xtr, Xte, ytr, yte, wtr, wte = train_test_split(X, ratio, weights, test_size=0.2, random_state=42)
        candidate = xgb.XGBRegressor(n_estimators=300, max_depth=4, learning_rate=0.05, subsample=0.9,
                                     colsample_bytree=0.9, random_state=42).fit(Xtr, ytr, sample_weight=wtr)
        cand_pred = candidate.predict(Xte)
        cand_metrics = {"r2": round(float(r2_score(yte, cand_pred)), 3), "mae_ratio": round(float(mean_absolute_error(yte, cand_pred)), 3)}

        bundle_path = os.path.join(C.MODELS_DIR, "models.joblib")
        metrics_path = os.path.join(C.MODELS_DIR, "metrics.json")
        live_metrics = json.load(open(metrics_path)) if os.path.exists(metrics_path) else {}
        live_yield_metrics = live_metrics.get("yield", {"r2": -999, "mae_ratio": 999})

        # Promote only if the candidate is not worse (allowing a small tolerance
        # for noise) - never automatically make the live model worse.
        not_worse = cand_metrics["r2"] >= live_yield_metrics.get("r2", -999) - 0.02 and \
            cand_metrics["mae_ratio"] <= live_yield_metrics.get("mae_ratio", 999) * 1.05

        print(f"Live model : {live_yield_metrics}")
        print(f"Candidate  : {cand_metrics}  (trained on {len(combined)} rows, {len(fb_df)} from verified feedback)")

        if not not_worse:
            print("Candidate is worse than the live model - NOT promoted.")
            return False

        reg = _load_registry()
        reg = _backup_current(reg)
        live_bundle = joblib.load(bundle_path) if os.path.exists(bundle_path) else {}
        live_bundle["yield"] = candidate
        joblib.dump(live_bundle, bundle_path)
        live_metrics["yield"] = cand_metrics
        live_metrics["note"] = live_metrics.get("note", "") + f" | retrained with {len(fb_df)} verified feedback rows on {dt.date.today().isoformat()}"
        json.dump(live_metrics, open(metrics_path, "w"), indent=2)
        print("Candidate promoted to the live model. Previous version backed up for rollback.")
        return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--rollback", action="store_true")
    args = parser.parse_args()
    if args.rollback:
        rollback()
    else:
        retrain_and_maybe_promote(create_app())
