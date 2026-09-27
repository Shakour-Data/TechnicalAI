from fastapi.testclient import TestClient
from unittest.mock import AsyncMock
from api.main import app
from api.auth import User


def _mock_user():
    return User(user_id="test_user", username="testuser", email="test@test.com", role="user")


def _override_auth():
    async def _get_current_user():
        return _mock_user()
    return _get_current_user


app.dependency_overrides[__import__("api.auth", fromlist=["get_current_active_user"]).get_current_active_user] = _override_auth()


def test_post_time_series_quick():
    client = TestClient(app)
    response = client.post("/api/v1/analysis/time-series", json={
        "symbol": "TEST", "analysis_type": "time_series",
        "horizon": 10, "mode": "quick", "model_keys": ["rf", "xgboost"]
    })
    assert response.status_code == 200
    data = response.json()
    assert "analysis_id" in data
    assert data["status"] == "processing"


def test_post_time_series_detailed():
    client = TestClient(app)
    response = client.post("/api/v1/analysis/time-series", json={
        "symbol": "TEST", "analysis_type": "time_series",
        "horizon": 10, "mode": "detailed"
    })
    assert response.status_code == 200
    data = response.json()
    assert "analysis_id" in data
    assert data["status"] == "processing"


def test_post_time_series_invalid_symbol():
    client = TestClient(app)
    response = client.post("/api/v1/analysis/time-series", json={
        "symbol": "", "analysis_type": "time_series"
    })
    assert response.status_code == 422


def test_post_analysis_non_time_series():
    client = TestClient(app)
    response = client.post("/api/v1/analysis", json={
        "symbol": "TEST", "analysis_type": "invalid_type"
    })
    assert response.status_code == 400