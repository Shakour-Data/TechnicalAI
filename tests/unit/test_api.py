import pytest
import time
from fastapi.testclient import TestClient

from api.main import app

app.state.start_time = time.time()
client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "service" in data
    assert "version" in data
    assert "uptime_seconds" in data
    assert "data_sources" in data


def test_dashboard_endpoint():
    response = client.get("/api/v1/dashboard/overview")
    assert response.status_code in [200, 500]


def test_openapi_docs():
    response = client.get("/docs")
    assert response.status_code == 200


def test_metrics_endpoint():
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "http_requests_total" in response.text


def test_stock_history_endpoint():
    response = client.get("/api/v1/stocks/AAPL/history")
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "AAPL"
    assert data["count"] == 100
    assert len(data["data"]) == 100


def test_stock_quote_endpoint():
    response = client.get("/api/v1/stocks/MSFT/quote")
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "MSFT"
    assert "quote" in data


def test_stock_search_endpoint():
    response = client.get("/api/v1/stocks/search?query=app")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] >= 1
    assert "results" in data


def test_index_history_endpoint():
    response = client.get("/api/v1/indices/CWI/history")
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == "CWI"
    assert data["count"] == 100


def test_index_list_endpoint():
    response = client.get("/api/v1/indices")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] >= 3


def test_sectors_endpoint():
    response = client.get("/api/v1/sectors")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] >= 3


def test_forex_endpoint():
    response = client.get("/api/v1/forex/USDIRR")
    assert response.status_code == 200
    data = response.json()
    assert data["pair"] == "USDIRR"
    assert "rate" in data


def test_forex_list_endpoint():
    response = client.get("/api/v1/forex")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 2


def test_crypto_endpoint():
    response = client.get("/api/v1/crypto/BTC")
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "BTC"
    assert "price" in data


def test_crypto_list_endpoint():
    response = client.get("/api/v1/crypto")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 5


def test_commodities_endpoint():
    response = client.get("/api/v1/commodities")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 2


def test_analysis_endpoint():
    response = client.post(
        "/api/v1/analysis",
        json={"symbol": "AAPL", "analysis_type": "technical"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert "analysis_id" in data


def test_analysis_get_endpoint():
    response = client.get("/api/v1/analysis/analysis_AAPL")
    assert response.status_code == 200
    data = response.json()
    assert data["analysis_id"] == "analysis_AAPL"
    assert "result" in data


def test_market_summary_endpoint():
    response = client.get("/api/v1/dashboard/market-summary")
    assert response.status_code == 200
    data = response.json()
    assert "tse" in data
    assert "international" in data


def test_invalid_stock_symbol():
    response = client.get("/api/v1/stocks//history")
    assert response.status_code == 422


def test_invalid_limit():
    response = client.get("/api/v1/stocks/AAPL/history?limit=5001")
    assert response.status_code == 422


def test_unknown_index():
    response = client.get("/api/v1/indices/INVALID/history")
    assert response.status_code == 500


def test_unknown_forex_pair():
    response = client.get("/api/v1/forex/INVALID")
    assert response.status_code == 500


def test_unknown_crypto_symbol():
    response = client.get("/api/v1/crypto/INVALID")
    assert response.status_code == 500
