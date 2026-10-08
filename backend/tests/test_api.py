import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import pytest
from app import create_app
from st01.services import rules, wording, ocr, trends, optimizer
from st01 import config as C


@pytest.fixture(scope="module")
def client():
    return create_app().test_client()


RICE = dict(crop="Rice", district="Thanjavur", texture="clay", N=220, P=8, K=140, pH=7.4, OC=0.55, rain30=120, rain48=5, temp=29)


def test_health_and_meta(client):
    assert client.get("/api/health").json["status"] == "ok"
    m = client.get("/api/meta").json
    assert len(m["crops"]) == 22 and "Thanjavur" in m["districts"]


def test_recommend_full_shape(client):
    r = client.post("/api/recommend", json=RICE).get_json()
    assert r["no_deficiency"] is False
    assert r["soil_rating"]["P"] == "low"
    for n in "NPK":
        d = r["dose"][n]
        assert d["low"] <= d["point"] <= d["high"] and d["point"] <= d["cap"] * 1.001
    assert r["plan"]["items"] and r["plan"]["cost"] > 0
    y = r["yield_estimate"]
    assert y["low_t_ha"] <= y["point_t_ha"] <= y["high_t_ha"]
    assert 0 <= r["sustainability"]["score"] <= 100
    assert r["why"] and r["rule_trace"]["balance"]
    assert "guaranteed" in r["disclaimer"]


def test_supply_never_exceeds_110pct_of_dose(client):
    r = client.post("/api/recommend", json=RICE).get_json()
    for n in "NPK":
        assert r["plan"]["supply"][n] <= r["dose"][n]["point"] * 1.101 + 0.2


def test_no_deficiency_branch(client):
    r = client.post("/api/recommend", json=dict(crop="Wheat", district="Karnal", texture="loam", N=620, P=30, K=320,
                                                pH=7.3, OC=0.8, rain30=80, temp=22)).get_json()
    assert r["no_deficiency"] is True and "No fertilizer" in r["message"] and r["plan"] is None


def test_report_wins_over_weather(client):
    r = client.post("/api/recommend", json=dict(RICE, N=400, P=15, K=200)).get_json()
    assert r["soil_rating"]["N"] == "medium"          # rating comes from the report, whatever the prior says


def test_high_nutrient_is_skipped(client):
    r = client.post("/api/recommend", json=dict(crop="Soybean", district="Indore", texture="clay", N=150, P=38, K=300,
                                                pH=7.8, OC=.7, rain30=120, temp=27)).get_json()
    assert r["dose"]["P"]["point"] == 0 and r["dose"]["K"]["point"] == 0


def test_crops_differ(client):
    a = client.post("/api/recommend", json=RICE).get_json()
    b = client.post("/api/recommend", json=dict(RICE, crop="Wheat")).get_json()
    assert a["dose"]["N"]["point"] != b["dose"]["N"]["point"]


def test_heavy_rain_raises_n_within_cap(client):
    a = client.post("/api/recommend", json=dict(RICE, crop="Maize", rain30=80)).get_json()
    b = client.post("/api/recommend", json=dict(RICE, crop="Maize", rain30=260)).get_json()
    assert b["dose"]["N"]["weather_adjustment_pct"] > a["dose"]["N"]["weather_adjustment_pct"]
    assert b["dose"]["N"]["point"] <= b["dose"]["N"]["cap"] + 1e-6


def test_rain_forecast_defers(client):
    r = client.post("/api/recommend", json=dict(RICE, rain48=70)).get_json()
    assert r["defer_application"] is True and any("rain" in w.lower() for w in r["why"])


def test_risk_warning_and_loop_back(client):
    r = client.post("/api/recommend", json=dict(crop="Cotton", district="Guntur", texture="loam", N=260, P=14, K=180,
                                                pH=7.2, OC=.6, rain30=260, temp=30)).get_json()
    assert r["risk"]["loop_back_tries"] <= 3
    if r["risk"]["warning"]:
        assert "lab test" in r["risk"]["text"]


def test_price_spike_changes_plan_or_cost(client):
    a = client.post("/api/recommend", json=RICE).get_json()
    b = client.post("/api/recommend", json=dict(RICE, dap_change=60)).get_json()
    assert b["plan"]["items"] != a["plan"]["items"] or b["plan"]["cost"] >= a["plan"]["cost"]


def test_objectives(client):
    for o in ("cheapest", "balanced_inm", "eco_inm"):
        r = client.post("/api/recommend", json=dict(RICE, objective=o)).get_json()
        assert r["plan"]["objective"] == o
    cheap = client.post("/api/recommend", json=RICE).get_json()["plan"]
    eco = client.post("/api/recommend", json=dict(RICE, objective="eco_inm")).get_json()["plan"]
    assert any(i["fertilizer"] == "Vermicompost" for i in eco["items"]) and eco["cost"] > cheap["cost"]
    r = client.post("/api/recommend", json=RICE).get_json()
    assert r["alternatives"]["eco_inm"]["sustainability_score"] >= r["plan"]["sustainability_score"]   # greener but costlier


def test_offline_context_from_district_only(client):
    r = client.post("/api/recommend", json=dict(crop="Rice", district="Thanjavur", N=220, P=8, K=140)).get_json()
    assert r["data_sources"]["weather"] and r["resolved_inputs"]["texture"] in C.TEXTURES


def test_location_only(client):
    r = client.post("/api/recommend", json=dict(crop="Maize", lat=30.9, lon=75.85, N=190, P=12, K=105)).get_json()
    assert r["location"]["district"] == "Ludhiana"


def test_validation_errors(client):
    assert client.post("/api/recommend", json={"crop": "Foo"}).status_code == 400
    assert client.post("/api/recommend", json=dict(RICE, pH=20)).status_code == 400
    assert client.post("/api/recommend", json={k: v for k, v in RICE.items() if k != "N"}).status_code == 400
    assert client.post("/api/recommend", data="nope", content_type="text/plain").status_code == 400


def test_compare(client):
    r = client.post("/api/compare", json={"A": RICE, "B": dict(RICE, crop="Wheat")}).get_json()
    assert r["why_it_changed"] and r["A"]["crop"] == "Rice" and r["B"]["crop"] == "Wheat"


def test_crop_recommend(client):
    r = client.post("/api/crop-recommend", json=dict(district="Thanjavur", N=300, P=15, K=190, pH=7)).get_json()
    assert len(r["top_crops"]) == 3


def test_trends(client):
    t = client.get("/api/climate-trend?district=Jaipur").get_json()
    assert t["rain_trend"] == "decreasing" and t["rain_sen_slope_mm_per_yr"] < -5
    p = client.get("/api/price-trend?fertilizer=DAP").get_json()
    assert p["direction"] == "rising" and len(p["forecast"]) == 3
    assert client.get("/api/price-trend?fertilizer=Nope").status_code == 400


def test_parse_report(client):
    r = client.post("/api/parse-report", json={"text": "Available Nitrogen 220 kg/ha\nPhosphorus (Olsen) 8\nPotassium 140\npH 7.4\nOrganic Carbon 0.55"}).get_json()
    assert r["parsed"] == {"N": 220.0, "P": 8.0, "K": 140.0, "pH": 7.4, "OC": 0.55}


def test_wording_guardrail():
    assert wording.numbers_preserved("Apply 60-80 kg/ha", "Put 60-80 kg/ha")
    assert not wording.numbers_preserved("Apply 60-80 kg/ha", "Put 90 kg/ha")
    assert wording.polish(["x 5"])[1] is False        # disabled without env vars


def test_rule_cap():
    d, _, _, _, _ = rules.apply_weather_rules({"N": 100, "P": 50, "K": 50},
        {"rain_30d_mm": 900, "temp_30d_c": 45, "soil_texture": "sandy", "pH": 4, "rain_anomaly_z": 0,
         "trend_rain_sen_slope": -50, "rain_forecast_48h_mm": 0})
    assert d["N"] <= 120.0001


def test_dry_trend_district_triggers_trend_rule(client):
    r = client.post("/api/recommend", json=dict(RICE, district="Jaipur", crop="Wheat")).get_json()
    assert any("trend_rain_sen_slope" in t["rule"] for t in r["rule_trace"]["weather_and_trend_rules"])


def test_price_spike_switches_dap(client):
    r = client.post("/api/recommend", json=dict(RICE, dap_change=30)).get_json()
    assert "DAP" not in [i["fertilizer"] for i in r["plan"]["items"]]


def test_model_info_is_honest(client):
    m = client.get("/api/model-info").get_json()
    assert "SYNTHETIC" in m["note"] and m["yield"]["empirical_coverage"] > 0.7
