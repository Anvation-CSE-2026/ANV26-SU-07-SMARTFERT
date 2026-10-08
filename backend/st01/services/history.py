"""Season assignment and a simple split-dose application timeline.
Season boundaries are editable in data/seasons.csv, not hard-coded."""
import datetime as dt
from .. import config as C, pipeline


def season_for(on_date=None):
    on_date = on_date or dt.date.today()
    m = on_date.month
    for season, bounds in C.SEASONS.items():
        lo, hi = bounds["start_month"], bounds["end_month"]
        if lo <= hi:
            if lo <= m <= hi:
                return season
        else:  # wraps the year end, e.g. Rabi Nov(11) -> Mar(3)
            if m >= lo or m <= hi:
                return season
    return None


# A handful of the existing demo scenarios (data/demo_scenarios.csv), chosen to
# look like a believable, varied season when a brand-new client's History page
# would otherwise be empty. Clearly marked `simulated=True` end to end - the
# UI must show a "demo data" badge on these, never pass them off as real.
DEMO_SCENARIO_IDS = ["S1", "S3", "S9"]
DEMO_STATUSES = ["applied", "planned", "planned"]
DEMO_AGE_DAYS = [55, 20, 3]


def seed_demo_history(client_id):
    from ..db import db, Recommendation
    if Recommendation.query.filter_by(client_id=client_id).count() > 0:
        return  # already has real (or previously-seeded) history - never overwrite it
    rows = C.SCEN[C.SCEN.scenario_id.isin(DEMO_SCENARIO_IDS)].set_index("scenario_id")
    now = dt.datetime.now(dt.timezone.utc)
    for sid, status, age_days in zip(DEMO_SCENARIO_IDS, DEMO_STATUSES, DEMO_AGE_DAYS):
        if sid not in rows.index:
            continue
        row = rows.loc[sid]
        drow = C.DIST.loc[row.district]
        # Supply every weather/soil field the pipeline would otherwise fetch live
        # (temp, texture) so seeding never makes a real network call and stays
        # instant and deterministic.
        texture = C.TEXTURE_OF_SOIL.get(str(drow.dominant_soil).strip().lower(), "loam")
        payload = {"crop": row.crop, "district": row.district, "N": float(row.N_kg_ha), "P": float(row.P_kg_ha),
                   "K": float(row.K_kg_ha), "OC": float(row.OC_pct), "pH": float(row.pH), "rain30": float(row.rain_30d_mm),
                   "rain48": 0.0, "temp": float(drow.mean_temp_c), "texture": texture}
        try:
            result = pipeline.recommend(payload)
        except pipeline.InputError:
            continue
        created_at = now - dt.timedelta(days=age_days)
        rec = Recommendation(client_id=client_id, season=season_for(created_at.date()), created_at=created_at,
                              crop=row.crop, inputs_json=payload, output_json=result,
                              model_version="demo-seed", status=status,
                              confidence=result.get("confidence", {}).get("score"),
                              sustainability=result.get("sustainability", {}).get("score"), simulated=True)
        db.session.add(rec)
    db.session.commit()


def application_schedule(sowing_date, dose, defer_application=False, defer_days=5):
    """A suggested basal / top-dress timeline, shifted later if heavy rain is forecast.
    These are SUGGESTIONS, not instructions - the farmer decides the actual dates."""
    if not dose:
        return []
    basal_offset = defer_days if defer_application else 0
    windows = [
        {"stage": "basal", "offset_days": basal_offset, "note": "Apply at or just before sowing."},
        {"stage": "top_dress_1", "offset_days": 25 + basal_offset, "note": "Early vegetative growth stage."},
        {"stage": "top_dress_2", "offset_days": 50 + basal_offset, "note": "Before flowering / panicle initiation."},
    ]
    schedule = []
    for w in windows:
        suggested_date = (sowing_date + dt.timedelta(days=w["offset_days"])) if sowing_date else None
        schedule.append({
            "stage": w["stage"],
            "suggested_date": suggested_date.isoformat() if suggested_date else None,
            "note": w["note"] + (" Shifted later because heavy rain was forecast." if defer_application and w["stage"] == "basal" else ""),
        })
    return schedule
