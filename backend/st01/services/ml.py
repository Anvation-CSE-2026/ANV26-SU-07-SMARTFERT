"""ML models (all trained on SYNTHETIC data; accuracy numbers describe the pipeline, not real fields):
  * early warning prior  : RandomForest per nutrient (weather+crop+soil texture -> P(deficiency))
  * yield regressor      : XGBoost on yield ratio + split-conformal 80% interval + SHAP explanation
  * crop recommender     : RandomForest classifier (soil + climate -> crop)"""
import json, os, math
import numpy as np
import pandas as pd
import joblib
import xgboost as xgb
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from .. import config as C

EW_NUM = ["rain_30d_mm", "rain_90d_mm", "temp_30d_c", "rain_anomaly_z", "leach_risk", "OC_pct", "pH"]
YF = ["dN_ratio", "dP_ratio", "dK_ratio", "N", "P", "K", "OC", "pH", "rain90", "temp", "anom", "tex_sandy", "tex_clay"]
YF_LABEL = {"dN_ratio": "N dose (vs cap)", "dP_ratio": "P dose (vs cap)", "dK_ratio": "K dose (vs cap)",
            "N": "soil N", "P": "soil P", "K": "soil K", "OC": "organic carbon", "pH": "soil pH",
            "rain90": "rain (90d)", "temp": "temperature", "anom": "rain anomaly",
            "tex_sandy": "sandy soil", "tex_clay": "clay soil"}
CROP_FEATS = ["N_kg_ha", "P_kg_ha", "K_kg_ha", "temperature_c", "humidity_pct", "rainfall_mm", "pH"]


def leach_formula(rain30, texture, anom, oc):
    return float(np.clip(rain30 / 150 + (texture == "sandy") * 0.4 + max(anom, 0) * 0.15 - oc * 0.2, 0, 1.5))


def ew_frame(df):
    X = pd.DataFrame({c: df[c].astype(float).values for c in EW_NUM})
    for t in C.TEXTURES:
        X[f"tex_{t}"] = (df["soil_texture"].values == t).astype(int)
    for cr in C.CROPS.index:
        X[f"crop_{cr}"] = (df["crop"].values == cr).astype(int)
    return X


def yield_frame(df):
    caps = C.CROPS.loc[df["crop"].values]
    X = pd.DataFrame({
        "dN_ratio": df["dose_N"].values / caps.cap_N_kg_ha.values,
        "dP_ratio": df["dose_P"].values / caps.cap_P2O5_kg_ha.values,
        "dK_ratio": df["dose_K"].values / caps.cap_K2O_kg_ha.values,
        "N": df["N"].values, "P": df["P"].values, "K": df["K"].values, "OC": df["OC"].values, "pH": df["pH"].values,
        "rain90": df["rain90"].values, "temp": df["temp"].values, "anom": df["anom"].values,
        "tex_sandy": (df["soil_texture"].values == "sandy").astype(int),
        "tex_clay": (df["soil_texture"].values == "clay").astype(int)})
    return X[YF].astype(float)


def train_all(verbose=True):
    os.makedirs(C.MODELS_DIR, exist_ok=True)
    metrics = {"note": "Trained on SYNTHETIC data. Scores show the pipeline works, not real-field accuracy."}

    # ---- early warning ----
    ew = C.csv("early_warning_train.csv")
    ewd = ew.rename(columns={"soil_texture": "soil_texture"})
    X = ew_frame(ewd)
    ew_models, ew_m = {}, {}
    for n in C.NUT:
        y = ew[f"ew_{n}_def"]
        Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
        m = RandomForestClassifier(n_estimators=200, max_depth=8, class_weight="balanced", random_state=42, n_jobs=-1).fit(Xtr, ytr)
        ew_models[n] = m
        ew_m[n] = {"f1": round(float(f1_score(yte, m.predict(Xte))), 3)}
    metrics["early_warning"] = ew_m

    # ---- yield (XGBoost + split conformal) ----
    yd = C.csv("yield_training.csv")
    df = pd.DataFrame({"crop": yd.crop, "dose_N": yd.dose_N_kg_ha, "dose_P": yd.dose_P2O5_kg_ha, "dose_K": yd.dose_K2O_kg_ha,
                       "N": yd.N_kg_ha, "P": yd.P_kg_ha, "K": yd.K_kg_ha, "OC": yd.OC_pct, "pH": yd.pH,
                       "rain90": yd.rain_90d_mm, "temp": yd.temp_30d_c, "anom": yd.rain_anomaly_z, "soil_texture": yd.soil_texture})
    ratio = (yd.yield_t_ha / C.CROPS.loc[yd.crop].default_target_yield_t_ha.values).values
    Xy = yield_frame(df)
    Xtr, Xtmp, ytr, ytmp = train_test_split(Xy, ratio, test_size=0.4, random_state=42)
    Xcal, Xte, ycal, yte = train_test_split(Xtmp, ytmp, test_size=0.5, random_state=42)
    reg = xgb.XGBRegressor(n_estimators=300, max_depth=4, learning_rate=0.05, subsample=0.9, colsample_bytree=0.9, random_state=42).fit(Xtr, ytr)
    res = np.abs(ycal - reg.predict(Xcal))
    q = float(np.quantile(res, min(1.0, math.ceil((len(res) + 1) * C.INTERVAL_COVERAGE) / len(res))))
    pte = reg.predict(Xte)
    cover = float(np.mean((yte >= pte - q) & (yte <= pte + q)))
    metrics["yield"] = {"r2": round(float(r2_score(yte, pte)), 3), "mae_ratio": round(float(mean_absolute_error(yte, pte)), 3),
                        "conformal_halfwidth_ratio": round(q, 3), "empirical_coverage": round(cover, 3)}

    # ---- crop recommender ----
    cr = C.csv("crop_recommendation_train.csv")
    Xc, yc = cr[CROP_FEATS], cr["label_crop"]
    Xtr, Xte, ytr, yte = train_test_split(Xc, yc, test_size=0.2, random_state=42, stratify=yc)
    clf = RandomForestClassifier(n_estimators=250, random_state=42, n_jobs=-1).fit(Xtr, ytr)
    metrics["crop_recommender"] = {"accuracy": round(float(accuracy_score(yte, clf.predict(Xte))), 3)}

    joblib.dump({"ew": ew_models, "yield": reg, "q": q, "crop": clf}, os.path.join(C.MODELS_DIR, "models.joblib"))
    json.dump(metrics, open(os.path.join(C.MODELS_DIR, "metrics.json"), "w"), indent=2)
    if verbose:
        print(json.dumps(metrics, indent=2))
    return metrics


class Registry:
    def __init__(self):
        self.bundle, self.metrics, self.explainer = None, {}, None

    def load(self):
        p = os.path.join(C.MODELS_DIR, "models.joblib")
        if not os.path.exists(p):
            train_all(verbose=False)
        self.bundle = joblib.load(p)
        self.metrics = json.load(open(os.path.join(C.MODELS_DIR, "metrics.json")))
        try:
            import shap
            self.explainer = shap.TreeExplainer(self.bundle["yield"])
        except Exception:
            self.explainer = None
        return self

    # ---- inference ----
    def early_warning(self, crop, texture, rain30, rain90, temp, anom, oc, ph):
        row = pd.DataFrame([{"rain_30d_mm": rain30, "rain_90d_mm": rain90, "temp_30d_c": temp, "rain_anomaly_z": anom,
                             "leach_risk": leach_formula(rain30, texture, anom, oc), "OC_pct": oc, "pH": ph,
                             "soil_texture": texture, "crop": crop}])
        X = ew_frame(row)
        return {n: round(float(self.bundle["ew"][n].predict_proba(X)[0][1]), 2) for n in C.NUT}

    def predict_yield(self, crop, texture, soil, oc, ph, dose, rain90, temp, anom, explain=False):
        df = pd.DataFrame([{"crop": crop, "dose_N": dose.get("N", 0), "dose_P": dose.get("P", 0), "dose_K": dose.get("K", 0),
                            "N": soil["N"], "P": soil["P"], "K": soil["K"], "OC": oc, "pH": ph,
                            "rain90": rain90, "temp": temp, "anom": anom, "soil_texture": texture}])
        X = yield_frame(df)
        scale = float(C.CROPS.loc[crop].default_target_yield_t_ha)
        p, q = float(self.bundle["yield"].predict(X)[0]), self.bundle["q"]
        out = {"point": max(p, 0.05) * scale, "low": max(p - q, 0.05) * scale, "high": (p + q) * scale}
        if explain and self.explainer is not None:
            try:
                sv = self.explainer.shap_values(X)[0]
                top = sorted(zip(YF, sv), key=lambda t: -abs(t[1]))[:5]
                out["drivers"] = [{"feature": YF_LABEL[f], "impact_t_ha": round(float(v) * scale, 2),
                                   "direction": "raises yield" if v > 0 else "lowers yield"} for f, v in top]
            except Exception:
                out["drivers"] = []
        return out

    def recommend_crops(self, N, P, K, temp, humidity, rainfall, ph, top=3):
        X = pd.DataFrame([{"N_kg_ha": N, "P_kg_ha": P, "K_kg_ha": K, "temperature_c": temp,
                           "humidity_pct": humidity, "rainfall_mm": rainfall, "pH": ph}])[CROP_FEATS]
        clf = self.bundle["crop"]
        pr = clf.predict_proba(X)[0]
        idx = np.argsort(-pr)[:top]
        return [{"crop": str(clf.classes_[i]), "probability": round(float(pr[i]), 3)} for i in idx]


registry = Registry()
