"""Seeds a batch of clearly-flagged SIMULATED feedback so the adaptive-learning
loop can be demonstrated without waiting for real farmers to report back.

    python scripts/seed_simulated_feedback.py

Every row this script creates has simulated=True end to end (Recommendation,
Feedback and the Calibration row they feed) - the UI must show a "simulated
data" badge wherever that calibration is used (see adaptive.build_meta /
Calibration.simulated). This is demo tooling, not a substitute for the real
feedback loop.
"""
import datetime as dt
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from st01 import config as C, pipeline
from st01.db import db, Client, Recommendation, Feedback
from st01.services import adaptive

DEMO_CLIENT_ID = "00000000-0000-4000-8000-000000000000"  # fixed, obviously-synthetic id

# A handful of crop/district pairs with a deliberate, consistent bias, so the
# calibration visibly moves once seeded (e.g. "farmers nearby keep reporting
# nitrogen deficiency symptoms even at the full recommended dose").
SCENARIOS = [
    {"crop": "Rice", "district": "Thanjavur", "base": dict(N=220, P=8, K=140, pH=7.4, OC=0.55, rain30=120, rain48=5, temp=29, texture="clay"),
     "bias": "under", "n": 7},
    {"crop": "Cotton", "district": "Guntur", "base": dict(N=260, P=14, K=180, pH=7.2, OC=0.6, rain30=260, rain48=10, temp=30, texture="loam"),
     "bias": "over", "n": 6},
    {"crop": "Wheat", "district": "Karnal", "base": dict(N=300, P=18, K=160, pH=7.0, OC=0.5, rain30=60, rain48=0, temp=18, texture="loam"),
     "bias": "ok", "n": 8},
]


def _feedback_for_bias(bias, rng):
    """under = still deficient despite the dose; over = excess/runoff; ok = about right."""
    if bias == "under":
        return {"issues": ["yellowing"], "retest": {"N": rng.uniform(150, 250)}, "rating": rng.choice([2, 3])}
    if bias == "over":
        return {"issues": ["runoff_event"], "retest": {"N": rng.uniform(600, 700)}, "rating": rng.choice([3, 4])}
    return {"issues": [], "retest": {"N": rng.uniform(300, 500)}, "rating": rng.choice([4, 5])}


def main():
    rng = random.Random(42)
    app = create_app()
    with app.app_context():
        if not db.session.get(Client, DEMO_CLIENT_ID):
            db.session.add(Client(id=DEMO_CLIENT_ID, language="en"))
            db.session.commit()

        created = 0
        for scenario in SCENARIOS:
            for i in range(scenario["n"]):
                payload = dict(scenario["base"], crop=scenario["crop"], district=scenario["district"], N=scenario["base"]["N"] + i)
                try:
                    result = pipeline.recommend(payload)
                except pipeline.InputError as e:
                    print(f"skip (invalid payload): {e}")
                    continue

                rec = Recommendation(
                    client_id=DEMO_CLIENT_ID, season="Kharif",
                    created_at=dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=rng.randint(10, 90)),
                    crop=scenario["crop"], inputs_json=payload, output_json=result,
                    model_version="demo-seed", status="applied",
                    confidence=result.get("confidence", {}).get("score"),
                    sustainability=result.get("sustainability", {}).get("score"), simulated=True,
                )
                db.session.add(rec)
                db.session.commit()

                fb_fields = _feedback_for_bias(scenario["bias"], rng)
                cleaned = adaptive.validate_feedback({"applied_status": "yes", **fb_fields})
                verified, _ = adaptive.determine_verification(scenario["crop"], adaptive.region_key_for(scenario["district"]), cleaned)
                fb = Feedback(rec_id=rec.id, client_id=DEMO_CLIENT_ID, applied_status=cleaned["applied_status"],
                              issues_json=cleaned["issues"], retest_json=cleaned["retest"], rating=cleaned["rating"],
                              verified=verified, simulated=True, created_at=rec.created_at + dt.timedelta(days=30))
                db.session.add(fb)
                db.session.commit()
                created += 1

        for scenario in SCENARIOS:
            region_key = adaptive.region_key_for(scenario["district"])
            row = adaptive.recompute_calibration(scenario["crop"], region_key)
            print(f"{scenario['crop']} / {region_key}: n_reports={row.n_reports}, "
                  f"dose_mult N={row.dose_mult_N:.3f} P={row.dose_mult_P:.3f} K={row.dose_mult_K:.3f}, "
                  f"simulated={row.simulated}")

        print(f"\nSeeded {created} simulated recommendation+feedback pairs under client_id={DEMO_CLIENT_ID}.")


if __name__ == "__main__":
    main()
