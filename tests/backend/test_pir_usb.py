"""Prueba USB aislada: guardado real en SQLite, consulta y reintentos."""

import pytest
from httpx import ASGITransport, AsyncClient
from app.config import settings
from app.database import get_db_connection, init_db
from app.main import app


@pytest.fixture
async def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "DATABASE_URL", f"sqlite+aiosqlite:///{tmp_path / 'pir_usb.db'}")
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


@pytest.mark.asyncio
async def test_save_history_and_retry_do_not_mix_usb_with_telemetry(client):
    readings = [
        {"received_at": "2026-10-04T15:00:00Z", "motion": True},
        {"received_at": "2026-10-04T15:00:01Z", "motion": False},
    ]
    response = await client.post("/api/v1/pir-usb/readings", json={"readings": readings})
    assert response.status_code == 200
    assert response.json() == {"saved_count": 2}

    # Nuevas conexiones HTTP/SQLite recuperan las lecturas, no solo un buffer.
    response = await client.get("/api/v1/pir-usb/readings")
    assert response.status_code == 200
    history = response.json()
    assert [row["motion"] for row in history] == [False, True]
    assert history[0]["received_at"].startswith("2026-10-04T15:00:01")

    # Guardar la misma lectura con otra representación de zona horaria tampoco duplica.
    readings[0]["received_at"] = "2026-10-04T12:00:00-03:00"
    response = await client.post("/api/v1/pir-usb/readings", json={"readings": readings})
    assert response.json() == {"saved_count": 0}
    limited = await client.get("/api/v1/pir-usb/readings?limit=1")
    assert len(limited.json()) == 1

    async with get_db_connection() as db:
        cursor = await db.execute("SELECT COUNT(*) FROM telemetry")
        assert (await cursor.fetchone())[0] == 0
        cursor = await db.execute("SELECT COUNT(*) FROM pir_usb_readings")
        assert (await cursor.fetchone())[0] == 2


@pytest.mark.asyncio
async def test_duplicate_batch_and_new_reading(client):
    reading = {"received_at": "2026-10-04T15:00:00Z", "motion": True}
    response = await client.post("/api/v1/pir-usb/readings", json={"readings": [reading, reading]})
    assert response.json() == {"saved_count": 1}
    next_reading = {"received_at": "2026-10-04T15:00:02Z", "motion": False}
    response = await client.post("/api/v1/pir-usb/readings", json={"readings": [reading, next_reading]})
    assert response.json() == {"saved_count": 1}


@pytest.mark.asyncio
@pytest.mark.parametrize("readings", [
    [],
    [{"received_at": "2026-10-04T15:00:00", "motion": True}],
    [{"received_at": "invalid", "motion": True}],
    [{"received_at": "2026-10-04T15:00:00Z", "motion": "false"}],
    [{"received_at": "2026-10-04T15:00:00Z", "motion": True}] * 51,
])
async def test_invalid_batch_is_rejected_without_writes(client, readings):
    response = await client.post("/api/v1/pir-usb/readings", json={"readings": readings})
    assert response.status_code == 422
    history = await client.get("/api/v1/pir-usb/readings")
    assert history.json() == []


@pytest.mark.asyncio
@pytest.mark.parametrize("limit", [0, -1, 501])
async def test_history_limit_is_bounded(client, limit):
    response = await client.get(f"/api/v1/pir-usb/readings?limit={limit}")
    assert response.status_code == 422
