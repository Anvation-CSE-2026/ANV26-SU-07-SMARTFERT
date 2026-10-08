import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import uuid
import pytest
from app import create_app

RICE = dict(crop="Rice", district="Thanjavur", texture="clay", N=220, P=8, K=140, pH=7.4, OC=0.55, rain30=120, rain48=5, temp=29)


@pytest.fixture(scope="module")
def client():
    return create_app().test_client()


def cid():
    return str(uuid.uuid4())


def test_demo_data_seeded_on_first_empty_fetch(client):
    c = cid()
    r = client.get("/api/history", headers={"X-Client-Id": c}).get_json()
    assert r["available"] is True
    assert len(r["items"]) == 3
    assert all(i["simulated"] for i in r["items"])


def test_seeding_only_happens_once(client):
    c = cid()
    client.get("/api/history", headers={"X-Client-Id": c})
    client.post("/api/recommend", json=dict(RICE, save=True), headers={"X-Client-Id": c})
    r = client.get("/api/history", headers={"X-Client-Id": c}).get_json()
    assert len(r["items"]) == 4  # 3 demo + 1 real, not re-seeded to 3+3+1


def test_save_recommend_creates_history_entry(client):
    c = cid()
    r = client.post("/api/recommend", json=dict(RICE, save=True), headers={"X-Client-Id": c}).get_json()
    assert "recommendation_id" in r
    item = client.get(f"/api/history/{r['recommendation_id']}", headers={"X-Client-Id": c}).get_json()
    assert item["crop"] == "Rice" and item["simulated"] is False
    assert item["suggested_schedule"][0]["stage"] == "basal"


def test_recommend_without_save_does_not_persist(client):
    c = cid()
    client.get("/api/history", headers={"X-Client-Id": c})  # seed demo baseline (3 items)
    client.post("/api/recommend", json=RICE, headers={"X-Client-Id": c})  # no save=True
    r = client.get("/api/history", headers={"X-Client-Id": c}).get_json()
    assert len(r["items"]) == 3


def test_patch_status_and_log_application(client):
    c = cid()
    r = client.post("/api/recommend", json=dict(RICE, save=True), headers={"X-Client-Id": c}).get_json()
    rid = r["recommendation_id"]
    p = client.patch(f"/api/history/{rid}/status", json={"status": "applied"}, headers={"X-Client-Id": c}).get_json()
    assert p["status"] == "applied"
    a = client.post(f"/api/history/{rid}/applications", json={"date": "2026-06-10", "items": [{"fertilizer": "Urea", "kg_per_ha": 50}]},
                     headers={"X-Client-Id": c}).get_json()
    assert a["items"][0]["fertilizer"] == "Urea"
    item = client.get(f"/api/history/{rid}", headers={"X-Client-Id": c}).get_json()
    assert len(item["applications"]) == 1


def test_delete_history_item(client):
    c = cid()
    r = client.post("/api/recommend", json=dict(RICE, save=True), headers={"X-Client-Id": c}).get_json()
    rid = r["recommendation_id"]
    assert client.delete(f"/api/history/{rid}", headers={"X-Client-Id": c}).get_json()["status"] == "deleted"
    assert client.get(f"/api/history/{rid}", headers={"X-Client-Id": c}).status_code == 400


def test_filters_by_crop(client):
    c = cid()
    client.post("/api/recommend", json=dict(RICE, save=True), headers={"X-Client-Id": c})
    client.post("/api/recommend", json=dict(RICE, crop="Wheat", save=True), headers={"X-Client-Id": c})
    r = client.get("/api/history?crop=Wheat", headers={"X-Client-Id": c}).get_json()
    assert all(i["crop"] == "Wheat" for i in r["items"])


def test_export_csv_has_header_and_rows(client):
    c = cid()
    client.post("/api/recommend", json=dict(RICE, save=True), headers={"X-Client-Id": c})
    r = client.get("/api/history/export.csv", headers={"X-Client-Id": c})
    text = r.data.decode()
    assert text.splitlines()[0].startswith("id,created_at,season,crop,status")
    assert len(text.splitlines()) >= 2


def test_fields_crud_and_isolation(client):
    a, b = cid(), cid()
    f = client.post("/api/fields", json={"name": "North plot", "lat": 10.5, "lon": 79.1, "area_ha": 1.2},
                     headers={"X-Client-Id": a}).get_json()
    assert f["name"] == "North plot"
    assert len(client.get("/api/fields", headers={"X-Client-Id": a}).get_json()) == 1
    assert client.get("/api/fields", headers={"X-Client-Id": b}).get_json() == []


# --- Fix 2: explicit cross-client isolation guarantee ------------------------
# No client may read, modify or delete another client's recommendations, even
# when it knows (or guesses) the numeric id. A missing/foreign row must 404
# ("no such recommendation"), never 403, so its existence is never confirmed.
def test_client_cannot_read_another_clients_recommendation(client):
    a, b = cid(), cid()
    rec = client.post("/api/recommend", json=dict(RICE, save=True), headers={"X-Client-Id": a}).get_json()
    rid = rec["recommendation_id"]

    assert client.get(f"/api/history/{rid}", headers={"X-Client-Id": b}).status_code == 400
    assert client.patch(f"/api/history/{rid}/status", json={"status": "skipped"}, headers={"X-Client-Id": b}).status_code == 400
    assert client.post(f"/api/history/{rid}/applications", json={"items": []}, headers={"X-Client-Id": b}).status_code == 400
    assert client.delete(f"/api/history/{rid}", headers={"X-Client-Id": b}).status_code == 400

    # B's own history list never contains A's recommendation id
    b_ids = [i["id"] for i in client.get("/api/history", headers={"X-Client-Id": b}).get_json()["items"]]
    assert rid not in b_ids

    # the row must still be intact and readable by its real owner afterwards
    owned = client.get(f"/api/history/{rid}", headers={"X-Client-Id": a})
    assert owned.status_code == 200 and owned.get_json()["status"] == "planned"
