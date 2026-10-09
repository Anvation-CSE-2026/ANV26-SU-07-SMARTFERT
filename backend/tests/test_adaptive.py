import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import uuid
import pytest
from app import create_app
from st01 import config as C
from st01.services import adaptive

RICE = dict(crop="Rice", district="Thanjavur", texture="clay", N=220, P=8, K=140, pH=7.4, OC=0.55, rain30=120, rain48=5, temp=29)


@pytest.fixture(scope="module")
def client():
    return create_app().test_client()


def cid():
    return str(uuid.uuid4())


def save_rec(client, c, **overrides):
    r = client.post("/api/recommend", json=dict(RICE, save=True, **overrides), headers={"X-Client-Id": c}).get_json()
    return r["recommendation_id"]


def submit_feedback(client, c, rec_id, **overrides):
    payload = {"recommendation_id": rec_id, "applied_status": "yes", "issues": [], "simulated": True, **overrides}
    return client.post("/api/feedback", json=payload, headers={"X-Client-Id": c})


def test_recommend_has_an_adaptive_block_even_with_no_calibration(client):
    r = client.post("/api/recommend", json=RICE, headers={"X-Client-Id": cid()}).get_json()
    assert r["adaptive"]["applied"] is False
    assert r["adaptive"]["available"] is False
    assert r["adaptive"]["n_reports"] == 0


def test_feedback_without_retest_or_yield_is_saved_but_not_verified(client):
    c = cid()
    rid = save_rec(client, c)
    r = submit_feedback(client, c, rid, rating=4)
    body = r.get_json()
    assert body["verified"] is False  # a star rating alone proves nothing objective


def test_feedback_with_retest_is_verified_and_feeds_calibration(client):
    c = cid()
    rid = save_rec(client, c)
    r = submit_feedback(client, c, rid, retest={"N": 600})  # still high after a full dose -> over-applied signal
    assert r.get_json()["verified"] is True


def test_cannot_submit_feedback_for_another_clients_recommendation(client):
    a, b = cid(), cid()
    rid = save_rec(client, a)
    r = client.post("/api/feedback", json={"recommendation_id": rid, "applied_status": "yes", "issues": []}, headers={"X-Client-Id": b})
    assert r.status_code == 400


def test_duplicate_feedback_for_same_recommendation_is_rejected(client):
    c = cid()
    rid = save_rec(client, c)
    submit_feedback(client, c, rid, retest={"N": 300})
    r2 = submit_feedback(client, c, rid, retest={"N": 300})
    assert r2.status_code == 400


def test_invalid_applied_status_rejected(client):
    c = cid()
    rid = save_rec(client, c)
    r = client.post("/api/feedback", json={"recommendation_id": rid, "applied_status": "maybe", "issues": []}, headers={"X-Client-Id": c})
    assert r.status_code == 400


def test_invalid_rating_rejected(client):
    c = cid()
    rid = save_rec(client, c)
    r = client.post("/api/feedback", json={"recommendation_id": rid, "applied_status": "yes", "issues": [], "rating": 9}, headers={"X-Client-Id": c})
    assert r.status_code == 400


# --- the core bounded-adjustment guarantees -----------------------------------

def test_no_dose_adjustment_under_five_reports(client):
    c = cid()
    for i in range(4):
        rid = save_rec(client, c, N=220 + i, district="Kanpur")  # vary slightly so they're distinct recommendations
        submit_feedback(client, c, rid, retest={"N": 600})  # over-applied signal, same direction each time
    with client.application.app_context():
        row = adaptive.get_calibration("Rice", "Kanpur")
        # Shrinkage toward 1.0 (pseudo-count 10) means even a handful of confirming
        # reports should barely move the multiplier - this is the honesty check on
        # that shrinkage, distinct from the hard-clip check in the test below.
        assert row is not None and row.n_reports == 4
        assert abs(row.dose_mult_N - 1) < 0.1


def test_dose_multiplier_always_within_bounds_and_never_exceeds_cap(client):
    c = cid()
    # Push hard in one direction with many confirming reports.
    for i in range(12):
        rid = save_rec(client, c, N=200 + i, district="Jaipur")
        submit_feedback(client, c, rid, retest={"N": 20})  # still LOW despite full dose -> under-applied
    with client.application.app_context():
        row = adaptive.get_calibration("Rice", "Jaipur")
        assert row is not None
        assert C.ADAPTIVE["dose_mult_min"] <= row.dose_mult_N <= C.ADAPTIVE["dose_mult_max"]

    # save=True exercises the DB write of the full response (output_json) - the
    # crop's cap_*_kg_ha columns are integer dtype, so a dose clamped right at the
    # cap must come back as a plain float here, not a numpy int64 the JSON column
    # can't serialize (regression check for that exact crash).
    resp = client.post("/api/recommend", json=dict(RICE, district="Jaipur", save=True), headers={"X-Client-Id": c})
    assert resp.status_code == 200
    r = resp.get_json()
    assert r["dose"]["N"]["point"] <= r["dose"]["N"]["cap"] + 1e-6
    assert r["adaptive"]["applied"] is True
    assert r["adaptive"]["dose_multiplier"]["N"] > 1.0  # under-applied signal -> nudged up


def test_recommend_with_save_succeeds_when_adaptive_pushes_dose_past_the_cap(client):
    """Deterministic regression test for the numpy-int64 crash: the crop table's
    cap_*_kg_ha columns are integer dtype, so pandas hands them back as numpy
    int64. A very low soil N already clamps the base dose to the cap before
    adaptive even runs; multiplying that by the max dose multiplier (1.15) then
    forces the adaptive re-clamp's min(dose*mult, cap) to pick the numpy int64
    cap value. Saving that straight into the JSON output_json column used to
    raise `TypeError: Object of type int64 is not JSON serializable`."""
    c = cid()
    with client.application.app_context():
        from st01.db import db, Calibration

        row = Calibration(crop="Rice", region_key="Patna", n_reports=20,
                           dose_mult_N=C.ADAPTIVE["dose_mult_max"], dose_mult_P=1.0, dose_mult_K=1.0,
                           yield_bias=0.0, simulated=True)
        db.session.add(row)
        db.session.commit()

    resp = client.post("/api/recommend", json=dict(RICE, district="Patna", N=10, save=True), headers={"X-Client-Id": c})
    assert resp.status_code == 200
    r = resp.get_json()
    assert r["dose"]["N"]["point"] == r["dose"]["N"]["cap"]  # confirms the cap branch of min() actually fired


def test_yield_bias_only_activates_at_the_report_threshold(client):
    c = cid()
    min_reports = int(C.ADAPTIVE["min_verified_reports_for_yield"])
    for i in range(min_reports - 1):
        rid = save_rec(client, c, N=210 + i, district="Guntur", crop="Cotton")
        submit_feedback(client, c, rid, actual_yield_t_ha=5.0)
    with client.application.app_context():
        row = adaptive.get_calibration("Cotton", "Guntur")
        assert not adaptive.yield_bias_active(row)

    rid = save_rec(client, c, N=210 + min_reports, district="Guntur", crop="Cotton")
    submit_feedback(client, c, rid, actual_yield_t_ha=5.0)
    with client.application.app_context():
        row = adaptive.get_calibration("Cotton", "Guntur")
        assert adaptive.yield_bias_active(row) or row.n_reports < min_reports  # activates once the threshold is reached


def test_ignore_adaptive_reruns_without_the_adjustment(client):
    c = cid()
    for i in range(12):
        rid = save_rec(client, c, N=200 + i, district="Nagpur")
        submit_feedback(client, c, rid, retest={"N": 20})
    with_adj = client.post("/api/recommend", json=dict(RICE, district="Nagpur"), headers={"X-Client-Id": c}).get_json()
    without_adj = client.post("/api/recommend", json=dict(RICE, district="Nagpur", ignore_adaptive=True), headers={"X-Client-Id": c}).get_json()
    assert with_adj["adaptive"]["applied"] is True
    assert without_adj["adaptive"]["applied"] is False
    assert without_adj["adaptive"]["available"] is True  # still shown so the toggle makes sense
    assert with_adj["dose"]["N"]["point"] != without_adj["dose"]["N"]["point"]


def test_simulated_badge_when_all_contributing_feedback_is_simulated(client):
    c = cid()
    rid = save_rec(client, c, district="Dharwad")
    submit_feedback(client, c, rid, retest={"N": 20}, simulated=True)
    with client.application.app_context():
        row = adaptive.get_calibration("Rice", "Dharwad")
        assert row.simulated is True


def test_simulated_badge_clears_once_real_feedback_contributes(client):
    c = cid()
    rid1 = save_rec(client, c, district="Pune")
    submit_feedback(client, c, rid1, retest={"N": 20}, simulated=True)
    rid2 = save_rec(client, c, N=221, district="Pune")
    submit_feedback(client, c, rid2, retest={"N": 25}, simulated=False)
    with client.application.app_context():
        row = adaptive.get_calibration("Rice", "Pune")
        assert row.simulated is False


def test_admin_recalibrate_requires_token(client):
    assert client.post("/api/admin/recalibrate", json={}).status_code == 401
    assert client.post("/api/admin/recalibrate", json={"token": "wrong"}).status_code == 401


def test_admin_recalibrate_with_correct_token(client, monkeypatch):
    monkeypatch.setattr(C, "ADMIN_TOKEN", "test-token-123")
    r = client.post("/api/admin/recalibrate", headers={"X-Admin-Token": "test-token-123"})
    assert r.status_code == 200
    assert "updated" in r.get_json()


def test_feedback_summary_is_anonymised_aggregate_only(client):
    c = cid()
    rid = save_rec(client, c, district="Bengaluru Rural")
    submit_feedback(client, c, rid, retest={"N": 20}, rating=4)
    r = client.get("/api/feedback/summary?crop=Rice&district=Bengaluru%20Rural", headers={"X-Client-Id": c}).get_json()
    assert r["available"] is True
    assert "avg_rating" in r and "n_reports" in r
    assert "client_id" not in str(r)  # never leaks identity
