"""Tests para endpoints de telemetría y persistencia en SQLite."""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import init_db
from app.repositories.telemetry_repository import telemetry_repo
from app.constants import CaseId


@pytest.mark.parametrize("path", ["telemetry/pir/history", "metrics/pir/trials"])
@pytest.mark.parametrize("limit", [-1, 0, 501])
async def test_history_queries_reject_unbounded_limits(path, limit):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/{path}?limit={limit}")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_telemetry_status_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/telemetry/status")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 3


@pytest.mark.asyncio
async def test_telemetry_case_and_history_endpoints():
    await init_db()

    # Encolar y vaciar una muestra persistida
    telemetry_repo.enqueue(
        case_id=CaseId.PIR.value,
        presence=True,
        raw_value=1.0,
        latency_ms=145.0,
        score=1.0,
    )
    await telemetry_repo.flush()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Consulta de telemetría instantánea
        res_live = await ac.get(f"/api/v1/telemetry/{CaseId.PIR.value}")
        assert res_live.status_code == 200
        live_data = res_live.json()
        assert live_data["case_id"] == "pir"

        # Consulta de histórico persistido en SQLite
        res_history = await ac.get(f"/api/v1/telemetry/{CaseId.PIR.value}/history?limit=10")
        assert res_history.status_code == 200
        history_data = res_history.json()
        assert isinstance(history_data, list)
        assert len(history_data) >= 1
        assert history_data[0]["case_id"] == "pir"
        assert history_data[0]["presence"] is True
