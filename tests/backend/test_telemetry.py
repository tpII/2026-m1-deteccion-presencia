"""Tests para endpoints de telemetría y persistencia en SQLite."""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database.connection import init_db
from app.repositories.telemetry_repository import telemetry_repo
from app.core.constants import CaseId


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
    telemetry_repo.queue_telemetry_for_persistence(
        case_id=CaseId.PIR.value,
        presence=True,
        raw_value=1.0,
        latency_ms=145.0,
        score=1.0,
    )
    await telemetry_repo.flush_persisted()

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
