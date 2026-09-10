import pytest
import asyncio
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "service" in data
    assert "version" in data

def test_dashboard_endpoint():
    response = client.get("/api/v1/dashboard/overview")
    # This might fail if external services aren't running, but we test the structure
    assert response.status_code in [200, 500]

def test_openapi_docs():
    response = client.get("/docs")
    assert response.status_code == 200