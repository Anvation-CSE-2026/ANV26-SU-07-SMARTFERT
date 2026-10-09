"""Feedback-loop learning: the system nudges itself toward what actually
happened on real fields, transparently and within hard bounds. It NEVER
overrides the soil report, the crop caps, or the rule engine's own +/-20%
weather limit - it only nudges the dose multiplier (clipped to
[dose_mult_min, dose_mult_max]) and the yield estimate's bias (clipped to
[yield_bias_min_pct, yield_bias_max_pct]), and only once enough VERIFIED
reports exist. All thresholds are editable in data/adaptive_params.csv.
"""
from .. import config as C
from .rules import rate

ALLOWED_STATUS = {"yes", "partly", "no"}
ALLOWED_ISSUES = {"yellowing", "lodging", "runoff_event", "none"}


def region_key_for(district):
    """The calibration granularity. A district is already the finest unit
    tracked elsewhere in this app; kept as its own function so a future,
    coarser grouping (e.g. agro-climatic zone) is a one-line change."""
    return district or "unknown"


def _clip(x, lo, hi):
    return max(lo, min(hi, x))


def validate_feedback(body):
    status = body.get("applied_status")
    if status not in ALLOWED_STATUS:
        from ..pipeline import InputError
        raise InputError(f"applied_status must be one of {sorted(ALLOWED_STATUS)}")
    issues = body.get("issues") or []
    if not isinstance(issues, list) or any(i not in ALLOWED_ISSUES for i in issues):
        from ..pipeline import InputError
        raise InputError(f"issues must be a list drawn from {sorted(ALLOWED_ISSUES)}")
    rating = body.get("rating")
    if rating is not None and (not isinstance(rating, (int, float)) or not 1 <= rating <= 5):
        from ..pipeline import InputError
        raise InputError("rating must be between 1 and 5")
    actual_yield = body.get("actual_yield_t_ha")
    if actual_yield is not None and (not isinstance(actual_yield, (int, float)) or not 0 < actual_yield < 200):
        from ..pipeline import InputError
        raise InputError("actual_yield_t_ha must be a positive number")
    retest = body.get("retest") or {}
    for n in C.NUT:
        if n in retest and retest[n] is not None and not isinstance(retest[n], (int, float)):
            from ..pipeline import InputError
            raise InputError(f"retest.{n} must be a number")
    return {
        "applied_status": status, "issues": issues, "rating": int(rating) if rating is not None else None,
        "actual_yield_t_ha": float(actual_yield) if actual_yield is not None else None,
        "retest": {n: float(retest[n]) for n in C.NUT if retest.get(n) is not None} or None,
        "applied_doses": body.get("applied_doses") or None,
    }


def _mad_outlier(values, candidate, threshold):
    """Robust (median absolute deviation) outlier check - resistant to a
    handful of wild reports skewing the whole calibration."""
    if len(values) < 3:
        return False
    import numpy as np
    arr = np.array(values, dtype=float)
    med = np.median(arr)
    mad = np.median(np.abs(arr - med)) or 1e-6
    z = 0.6745 * abs(candidate - med) / mad
    return z > threshold


def determine_verification(crop, region_key, cleaned):
    """A report only counts toward calibration if it carries SOME objective
    signal (a retest or an actual yield) - a star rating alone is too thin to
    verify anything - and, when a yield is given, it isn't a wild outlier
    against this crop/region's other verified yields."""
    if cleaned["retest"] is None and cleaned["actual_yield_t_ha"] is None:
        return False, False
    if cleaned["actual_yield_t_ha"] is not None:
        from ..db import db, Feedback, Recommendation
        prior = (
            Feedback.query.join(Recommendation, Feedback.rec_id == Recommendation.id)
            .filter(Recommendation.crop == crop, Feedback.verified == True, Feedback.actual_yield_t_ha.isnot(None))
            .all()
        )
        same_region = [f.actual_yield_t_ha for f in prior
                       if region_key_for((db.session.get(Recommendation, f.rec_id).inputs_json or {}).get("district")) == region_key]
        prior_yields = same_region or [f.actual_yield_t_ha for f in prior]
        if _mad_outlier(prior_yields, cleaned["actual_yield_t_ha"], C.ADAPTIVE["outlier_mad_threshold"]):
            return False, True
    return True, False


def _ewma(values, alpha):
    if not values:
        return None
    m = values[0]
    for v in values[1:]:
        m = alpha * v + (1 - alpha) * m
    return m


def _dose_direction_votes(crop, region_key):
    from ..db import db, Feedback, Recommendation
    votes = {n: [] for n in C.NUT}
    rows = (
        Feedback.query.join(Recommendation, Feedback.rec_id == Recommendation.id)
        .filter(Recommendation.crop == crop, Feedback.verified == True)
        .all()
    )
    for fb in rows:
        rec = db.session.get(Recommendation, fb.rec_id)
        district = (rec.inputs_json or {}).get("district")
        if region_key_for(district) != region_key:
            continue
        issues = fb.issues_json or []
        if "yellowing" in issues:
            votes["N"].append(1)  # symptom despite the dose -> we under-applied
        if "lodging" in issues:
            votes["N"].append(-1)  # excess vegetative growth -> we over-applied
        if "runoff_event" in issues:
            votes["N"].append(-1)
            votes["K"].append(-1)  # the two most leaching-prone nutrients
        retest = fb.retest_json or {}
        for n in C.NUT:
            if retest.get(n) is not None:
                r = rate(n, float(retest[n]))
                if r == "low":
                    votes[n].append(1)
                elif r == "high":
                    votes[n].append(-1)
    return votes


def _yield_residual_ratios(crop, region_key):
    from ..db import db, Feedback, Recommendation
    rows = (
        Feedback.query.join(Recommendation, Feedback.rec_id == Recommendation.id)
        .filter(Recommendation.crop == crop, Feedback.verified == True, Feedback.actual_yield_t_ha.isnot(None))
        .order_by(Feedback.created_at)
        .all()
    )
    out = []
    all_simulated = True
    for fb in rows:
        rec = db.session.get(Recommendation, fb.rec_id)
        if region_key_for((rec.inputs_json or {}).get("district")) != region_key:
            continue
        predicted = ((rec.output_json or {}).get("yield_estimate") or {}).get("point_t_ha")
        if predicted and predicted > 0:
            out.append(fb.actual_yield_t_ha / predicted - 1.0)
            all_simulated = all_simulated and fb.simulated
    return out, all_simulated


def recompute_calibration(crop, region_key):
    """Recomputes this crop/region's whole Calibration row from every
    currently-verified feedback report - called after each new feedback
    submission and by POST /api/admin/recalibrate."""
    from ..db import db, Calibration

    votes = _dose_direction_votes(crop, region_key)
    pseudo = C.ADAPTIVE["dose_prior_pseudo_count"]
    step = C.ADAPTIVE["dose_step_pct"] / 100.0
    mults = {}
    n_reports_total = 0
    all_simulated_dose = True
    for n in C.NUT:
        v = votes[n]
        n_reports_total = max(n_reports_total, len(v))
        raw = 1.0 + step * sum(v)
        shrunk = (pseudo * 1.0 + len(v) * raw) / (pseudo + len(v)) if v else 1.0
        mults[n] = _clip(shrunk, C.ADAPTIVE["dose_mult_min"], C.ADAPTIVE["dose_mult_max"])

    residuals, yield_all_simulated = _yield_residual_ratios(crop, region_key)
    yield_bias = None
    if len(residuals) >= int(C.ADAPTIVE["min_verified_reports_for_yield"]):
        bias_ratio = _ewma(residuals, C.ADAPTIVE["yield_bias_ewma_alpha"])
        yield_bias = _clip(bias_ratio * 100, C.ADAPTIVE["yield_bias_min_pct"], C.ADAPTIVE["yield_bias_max_pct"])

    from ..db import Feedback, Recommendation
    all_fb = (
        Feedback.query.join(Recommendation, Feedback.rec_id == Recommendation.id)
        .filter(Recommendation.crop == crop, Feedback.verified == True)
        .all()
    )
    relevant = [f for f in all_fb if region_key_for((db.session.get(Recommendation, f.rec_id).inputs_json or {}).get("district")) == region_key]
    n_reports = len(relevant)
    simulated = bool(relevant) and all(f.simulated for f in relevant)

    row = db.session.get(Calibration, {"crop": crop, "region_key": region_key})
    if row is None:
        row = Calibration(crop=crop, region_key=region_key)
        db.session.add(row)
    row.n_reports = n_reports
    row.dose_mult_N, row.dose_mult_P, row.dose_mult_K = mults["N"], mults["P"], mults["K"]
    row.yield_bias = yield_bias if yield_bias is not None else 0.0
    row.simulated = simulated
    db.session.commit()
    return row


def get_calibration(crop, district):
    """The raw Calibration row for this crop/region, or None if nothing has
    been learned yet - kept as plain data so the pipeline applies the actual
    multiply-and-reclamp-to-cap itself, right where its own dose/cap/yield
    variables already live."""
    from ..db import Calibration

    region_key = region_key_for(district)
    return Calibration.query.filter_by(crop=crop, region_key=region_key).first()


def yield_bias_active(row):
    return bool(row) and row.n_reports >= int(C.ADAPTIVE["min_verified_reports_for_yield"]) and abs(row.yield_bias) > 1e-9


def build_meta(row, ignore_adaptive):
    """The `adaptive` block the API returns, and what the frontend's "ignore
    adaptive adjustment" toggle is reacting to. `available` stays true even
    when ignored, so the UI can still offer the toggle meaningfully."""
    if not row or row.n_reports <= 0:
        return {"applied": False, "available": False, "n_reports": 0}

    yield_active = yield_bias_active(row)
    pct_change = round(max(abs(row.dose_mult_N - 1), abs(row.dose_mult_P - 1), abs(row.dose_mult_K - 1)) * 100)
    meta = {
        "applied": not ignore_adaptive,
        "available": True,
        "n_reports": row.n_reports,
        "region_key": row.region_key,
        "dose_multiplier": {"N": round(row.dose_mult_N, 3), "P": round(row.dose_mult_P, 3), "K": round(row.dose_mult_K, 3)},
        "yield_bias_pct": round(row.yield_bias, 1) if yield_active else 0.0,
        "simulated": row.simulated,
        "message": (
            f"Adjusted dose by up to {pct_change}% using {row.n_reports} report(s) from similar farms nearby."
            if pct_change else f"{row.n_reports} report(s) from similar farms nearby confirmed this dose is about right."
        ),
    }
    return meta
