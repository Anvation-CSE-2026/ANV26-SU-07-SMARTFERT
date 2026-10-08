import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import uuid
import pytest
from app import create_app


@pytest.fixture(scope="module")
def client():
    return create_app().test_client()


def test_auto_assigns_a_client_id_when_missing(client):
    r = client.get("/api/health")
    assert r.headers.get("X-Client-Id")
    uuid.UUID(r.headers["X-Client-Id"])  # must be a real UUID


def test_me_profile_created_on_first_touch(client):
    cid = str(uuid.uuid4())
    r = client.get("/api/me", headers={"X-Client-Id": cid})
    assert r.get_json()["id"] == cid
    assert r.get_json()["consent_sharing"] is False


def test_consent_toggle(client):
    cid = str(uuid.uuid4())
    client.get("/api/me", headers={"X-Client-Id": cid})
    r = client.post("/api/me/consent", headers={"X-Client-Id": cid}, json={"consent_sharing": True, "language": "ta"})
    body = r.get_json()
    assert body["consent_sharing"] is True and body["language"] == "ta"
    r2 = client.get("/api/me", headers={"X-Client-Id": cid})
    assert r2.get_json()["consent_sharing"] is True


def test_delete_me_removes_all_client_rows(client):
    cid = str(uuid.uuid4())
    client.get("/api/me", headers={"X-Client-Id": cid})
    r = client.delete("/api/me", headers={"X-Client-Id": cid})
    assert r.get_json()["status"] == "deleted"
    # a fresh profile is created again on the very next call (anonymous, not an error)
    r2 = client.get("/api/me", headers={"X-Client-Id": cid})
    assert r2.get_json()["id"] == cid


def test_invalid_client_id_header_is_replaced_not_trusted(client):
    r = client.get("/api/health", headers={"X-Client-Id": "not-a-uuid"})
    returned = r.headers.get("X-Client-Id")
    assert returned != "not-a-uuid"
    uuid.UUID(returned)
