"""Tests para el endpoint de salud de la API."""

import pytest
from httpx import AsyncClient, ASGITransport
from fastapi.testclient import TestClient
from app.main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "data_source" in data


@pytest.mark.asyncio
async def test_root_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "project" in data


def test_websocket_initial_state_heartbeat_and_disconnect():
    """Comprueba el canal y el contador de conexiones sin abrir puertos ni usar hardware."""
    client = TestClient(app)
    with client.websocket_connect("/ws/telemetry") as websocket:
        initial = websocket.receive_json()
        assert initial["type"] == "initial_state"
        assert set(initial["data"]["cases"]) == {"pir", "csi_router", "csi_dedicated"}
        assert len(initial["data"]["statuses"]) == 3
        assert client.get("/api/v1/health").json()["active_ws_clients"] == 1
        websocket.send_text("ping")
        assert websocket.receive_text() == "pong"
    assert client.get("/api/v1/health").json()["active_ws_clients"] == 0
