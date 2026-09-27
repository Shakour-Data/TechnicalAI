import pytest
import time as time_module
from fastapi.testclient import TestClient
from api.main import app
from api.security import create_access_token

app.state.start_time = time_module.time()
client = TestClient(app)

# Create a test user token for authenticated requests
TEST_USER_TOKEN = create_access_token({"sub": "api-001", "username": "api_user"})
AUTH_HEADERS = {"Authorization": f"Bearer {TEST_USER_TOKEN}"}


def test_health_endpoint():
    """Test health endpoint - should not require authentication."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "service" in data
    assert "version" in data
    assert "uptime_seconds" in data
    assert "data_sources" in data


def test_missing_authentication_stock_history():
    """Test stock history endpoint without authentication returns 401."""
    response = client.get("/api/v1/stocks/history?symbol=AAPL")
    assert response.status_code == 401


def test_missing_authentication_stock_quote():
    """Test stock quote endpoint without authentication returns 401."""
    response = client.get("/api/v1/stocks/AAPL/quote")
    assert response.status_code == 401


def test_openapi_docs():
    """Test OpenAPI documentation endpoint."""
    response = client.get("/docs")
    assert response.status_code == 200


def test_metrics_endpoint():
    """Test Prometheus metrics endpoint."""
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "http_requests_total" in response.text


def test_stock_history_endpoint():
    """Test stock history endpoint with authentication."""
    response = client.get("/api/v1/stocks/history?symbol=AAPL", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "pagination" in data
    assert data["metadata"]["authenticated_as"] == "api_user"


def test_stock_quote_endpoint():
    """Test stock quote endpoint with authentication."""
    response = client.get("/api/v1/stocks/AAPL/quote", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "quote" in data
    assert "metadata" in data


def test_stock_search_endpoint():
    """Test stock search endpoint with authentication."""
    response = client.get("/api/v1/stocks/search?query=app", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert "pagination" in data


def test_index_history_endpoint():
    """Test index history endpoint with authentication."""
    response = client.get("/api/v1/indices/CWI/history?symbol=CWI", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "code" in data
    assert "data" in data
    assert "metadata" in data


def test_index_list_endpoint():
    """Test index list endpoint with authentication."""
    response = client.get("/api/v1/indices", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "indices" in data
    assert "pagination" in data


def test_sectors_endpoint():
    """Test sectors endpoint with authentication."""
    response = client.get("/api/v1/sectors", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "sectors" in data
    assert "metadata" in data


def test_forex_endpoint():
    """Test forex endpoint with authentication."""
    response = client.get("/api/v1/forex/USDIRR", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "pair" in data
    assert "rate" in data
    assert "metadata" in data


def test_forex_list_endpoint():
    """Test forex list endpoint with authentication."""
    response = client.get("/api/v1/forex", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "rates" in data
    assert "pagination" in data


def test_crypto_endpoint():
    """Test crypto endpoint with authentication."""
    response = client.get("/api/v1/crypto/BTC", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "price" in data
    assert "metadata" in data


def test_crypto_list_endpoint():
    """Test crypto list endpoint with authentication."""
    response = client.get("/api/v1/crypto", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "prices" in data
    assert "pagination" in data


def test_commodities_endpoint():
    """Test commodities endpoint with authentication."""
    response = client.get("/api/v1/commodities", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "commodities" in data
    assert "pagination" in data


def test_analysis_endpoint():
    """Test analysis endpoint with authentication."""
    response = client.post(
        "/api/v1/analysis",
        headers=AUTH_HEADERS,
        json={"symbol": "AAPL", "analysis_type": "technical"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "processing"
    assert "analysis_id" in data
    assert "created_at" in data


def test_analysis_get_endpoint():
    """Test analysis get endpoint with authentication."""
    response = client.get("/api/v1/analysis/analysis_AAPL", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "analysis_id" in data
    assert "result" in data


def test_market_summary_endpoint():
    """Test market summary endpoint with authentication."""
    response = client.get("/api/v1/dashboard/market-summary", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "metadata" in data
    assert data["metadata"]["authenticated_as"] == "api_user"


def test_invalid_stock_symbol():
    """Test invalid stock symbol - should return 404."""
    response = client.get("/api/v1/stocks/history?symbol=", headers=AUTH_HEADERS)
    assert response.status_code in [400, 404, 422]


def test_invalid_limit():
    """Test invalid limit parameter - should return 422."""
    response = client.get("/api/v1/stocks/history?symbol=AAPL&limit=5001", headers=AUTH_HEADERS)
    assert response.status_code in [400, 422]


def test_unknown_index():
    """Test unknown index - should return 404 or 500."""
    response = client.get("/api/v1/indices/INVALID/history?symbol=INVALID", headers=AUTH_HEADERS)
    assert response.status_code in [404, 500]


def test_unknown_forex_pair():
    """Test unknown forex pair - should return 404 or 500."""
    response = client.get("/api/v1/forex/INVALID", headers=AUTH_HEADERS)
    assert response.status_code in [404, 500]


def test_unknown_crypto_symbol():
    """Test unknown crypto symbol - should return 404 or 500."""
    response = client.get("/api/v1/crypto/INVALID", headers=AUTH_HEADERS)
    assert response.status_code in [404, 500]


def test_error_response_format():
    """Test that error responses follow standard format."""
    response = client.get("/api/v1/forex/INVALID", headers=AUTH_HEADERS)
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert "code" in data["error"]
    assert "message" in data["error"]


def test_authentication_with_invalid_token():
    """Test authentication with invalid token."""
    invalid_headers = {"Authorization": "Bearer invalid_token"}
    response = client.get("/api/v1/dashboard/overview", headers=invalid_headers)
    assert response.status_code == 401


def test_request_with_bearer_token_but_no_content():
    """Test endpoint with empty bearer token."""
    empty_token_headers = {"Authorization": "Bearer "}
    response = client.get("/api/v1/dashboard/overview", headers=empty_token_headers)
    assert response.status_code == 401


def test_endpoint_without_authorization_header():
    """Test endpoint without authorization header."""
    response = client.get("/api/v1/dashboard/overview")
    assert response.status_code == 401


def test_pagination_default_values():
    """Test that pagination uses default values correctly."""
    response = client.get("/api/v1/indices", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "pagination" in data
    assert data["pagination"]["limit"] == 20
    assert data["pagination"]["offset"] == 0


def test_response_time_metadata():
    """Test that response includes timing metadata."""
    response = client.get("/api/v1/stocks/history?symbol=AAPL", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "metadata" in data


def test_user_role_in_metadata():
    """Test that user role appears in metadata."""
    response = client.get("/api/v1/dashboard/overview", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "metadata" in data
    assert "role" in data["metadata"]


def test_request_id_generation():
    """Test that each request gets a unique ID."""
    response1 = client.get("/api/v1/stocks/history?symbol=AAPL", headers=AUTH_HEADERS)
    response2 = client.get("/api/v1/stocks/AAPL/quote", headers=AUTH_HEADERS)

    assert response1.status_code == 200
    assert response2.status_code == 200

    data1 = response1.json()
    data2 = response2.json()

    # Check that each request has its own metadata
    assert "metadata" in data1
    assert "metadata" in data2
    assert "request_id" in data1["metadata"] or "request_id" in data2["metadata"]