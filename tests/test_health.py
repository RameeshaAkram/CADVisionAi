"""Health-check endpoint tests."""

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_health_returns_200():
    response = client.get("/health")
    assert response.status_code == 200


def test_health_json_body():
    response = client.get("/health")
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "cad-ai"


def test_root_returns_200():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "cad-ai"
    assert data["docs"] == "/docs"
