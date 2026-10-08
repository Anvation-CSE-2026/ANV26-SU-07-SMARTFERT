import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import pytest
from app import create_app
from st01.services import confidence


@pytest.fixture(scope="module")
def client():
    return create_app().test_client()


RICE = dict(crop="Rice", district="Thanjavur", texture="clay", N=220, P=8, K=140, pH=7.4, OC=0.55, rain30=120, rain48=5, temp=29)


def test_confidence_present_and_bounded(client):
    r = client.post("/api/recommend", json=RICE).get_json()
    conf = r["confidence"]
    assert 0 <= conf["score"] <= 100
    assert conf["band"] in ("High", "Medium", "Low")
    assert "not a statistical probability" in conf["note"]


def test_confidence_is_deterministic(client):
    a = client.post("/api/recommend", json=RICE).get_json()["confidence"]
    b = client.post("/api/recommend", json=RICE).get_json()["confidence"]
    assert a == b


def test_band_thresholds_match_score():
    r = confidence.compute(
        {"N": 220, "P": 8, "K": 140, "OC": 0.55, "pH": 7.4, "rain90": 300, "temp": 29},
        {"N": "low", "P": "low", "K": "medium"}, {"N": 0.9, "P": 0.9, "K": 0.5},
        {"low": 3.0, "point": 4.0, "high": 5.0}, {"weather": "user", "soil_properties": "user"},
    )
    if r["score"] >= 75:
        assert r["band"] == "High"
    elif r["score"] >= 50:
        assert r["band"] == "Medium"
    else:
        assert r["band"] == "Low"


def test_renormalizes_when_components_missing():
    # feedback_support and satellite_agreement are None (features not built/available yet) -
    # the score must still land in [0, 100], not silently zero or crash.
    r = confidence.compute(
        {"N": 220, "P": 8, "K": 140, "OC": 0.55, "pH": 7.4, "rain90": 300, "temp": 29},
        {"N": "low", "P": "low", "K": "medium"}, {"N": 0.9, "P": 0.9, "K": 0.5},
        {"low": 3.0, "point": 4.0, "high": 5.0}, {"weather": "user", "soil_properties": "user"},
    )
    assert r["components"]["feedback_support"] is None
    assert r["components"]["satellite_agreement"] is None
    assert 0 <= r["score"] <= 100


def test_user_entered_context_scores_at_least_as_high_as_estimated():
    base_inp = {"N": 220, "P": 8, "K": 140, "OC": 0.55, "pH": 7.4, "rain90": 300, "temp": 29}
    rating, prior, y = {"N": "low", "P": "low", "K": "medium"}, {"N": 0.9, "P": 0.9, "K": 0.5}, {"low": 3.0, "point": 4.0, "high": 5.0}
    live = confidence.compute(base_inp, rating, prior, y, {"weather": "user", "soil_properties": "user"})
    estimated = confidence.compute(base_inp, rating, prior, y, {"weather": "fallback", "soil_properties": "fallback"})
    assert live["score"] >= estimated["score"]


def test_tighter_interval_scores_at_least_as_high():
    base_inp = {"N": 220, "P": 8, "K": 140, "OC": 0.55, "pH": 7.4, "rain90": 300, "temp": 29}
    rating, prior, src = {"N": "low", "P": "low", "K": "medium"}, {"N": 0.9, "P": 0.9, "K": 0.5}, {"weather": "user", "soil_properties": "user"}
    tight = confidence.compute(base_inp, rating, prior, {"low": 3.8, "point": 4.0, "high": 4.2}, src)
    wide = confidence.compute(base_inp, rating, prior, {"low": 1.0, "point": 4.0, "high": 7.0}, src)
    assert tight["score"] >= wide["score"]


def test_old_soil_report_lowers_data_quality():
    inp = {"N": 220, "P": 8, "K": 140, "OC": 0.55, "pH": 7.4, "rain90": 300, "temp": 29}
    rating, prior, y, src = {"N": "low", "P": "low", "K": "medium"}, {"N": 0.9, "P": 0.9, "K": 0.5}, {"low": 3.0, "point": 4.0, "high": 5.0}, {"weather": "user", "soil_properties": "user"}
    fresh = confidence.compute(inp, rating, prior, y, src, soil_report_age_years=1)
    old = confidence.compute(inp, rating, prior, y, src, soil_report_age_years=6)
    assert old["components"]["data_quality"] < fresh["components"]["data_quality"]
    assert old["score"] <= fresh["score"]


def test_out_of_distribution_inputs_flagged():
    rating, prior, y, src = {"N": "low", "P": "low", "K": "medium"}, {"N": 0.9, "P": 0.9, "K": 0.5}, {"low": 3.0, "point": 4.0, "high": 5.0}, {"weather": "user", "soil_properties": "user"}
    normal = confidence.compute({"N": 300, "P": 15, "K": 150, "OC": 0.5, "pH": 6.8, "rain90": 300, "temp": 27}, rating, prior, y, src)
    extreme = confidence.compute({"N": 1400, "P": 290, "K": 1400, "OC": 4.9, "pH": 9.9, "rain90": 3900, "temp": 49}, rating, prior, y, src)
    assert extreme["components"]["in_distribution"] < normal["components"]["in_distribution"]
