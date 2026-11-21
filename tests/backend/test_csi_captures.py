from datetime import datetime, timedelta, timezone
import json

from httpx import ASGITransport, AsyncClient
import pytest

from app.database import get_db_connection, init_db
from app.main import app
from app import telemetry
from app.api import csi_captures
from app.repositories import csi_capture_repository
from app.repositories.telemetry_repository import telemetry_repo
from app.schemas.telemetry import CsiRawSample, TelemetrySample
from app.telemetry import TelemetryService
from app.telemetry_state import TelemetryState


async def test_capture_uses_persisted_csi_packets_from_its_environment_and_interval(monkeypatch):
    class Clock(datetime):
        current = datetime.now(timezone.utc) - timedelta(seconds=15)

        @classmethod
        def now(cls, tz):
            return cls.current.astimezone(tz)

    monkeypatch.setattr(csi_capture_repository, "datetime", Clock)
    monkeypatch.setattr(csi_captures, "datetime", Clock)
    monkeypatch.setattr(telemetry, "datetime", Clock)
    await init_db()
    service = TelemetryService(TelemetryState())
    sample = CsiRawSample(case_id="csi_router", source="esp32-prueba", amplitudes=[2] * 54 + [4])
    path = "/api/v1/csi/captures"
    await service.handle_incoming_sample("csi_router", sample)
    Clock.current += timedelta(seconds=1)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        request = {"environment": " Casa A ", "activity": "walking"}
        response = await client.post(path, json=request)
        assert response.status_code == 201
        capture_id = response.json()["id"]
        assert (await client.post(path, json=request)).status_code == 409
        assert (await client.get(path)).json()["active_capture"]["id"] == capture_id

        Clock.current += timedelta(milliseconds=100)
        await service.handle_incoming_sample("csi_router", sample)
        await service.handle_incoming_sample("csi_router", sample)
        Clock.current += timedelta(milliseconds=10)
        preview = (await client.get(f"{path}/{capture_id}/preview")).json()
        assert preview["active"]
        assert preview["heatmap"]["column_count"] == 1
        assert [column["index"] for column in preview["heatmap"]["columns"]] == [0]
        Clock.current += timedelta(milliseconds=500)
        await service.handle_incoming_sample("csi_router", sample)
        Clock.current += timedelta(milliseconds=500)
        assert (await client.post(f"{path}/{capture_id}/finish")).status_code == 200
        await service.handle_incoming_sample("csi_router", sample)
        await service.handle_incoming_sample("pir", TelemetrySample(case_id="pir", presence=True, raw_value=1))

        comparison = (await client.get(path, params={"environment": "Casa A"})).json()
        assert comparison["active_capture"] is None
        [heatmap] = comparison["heatmaps"]
        assert heatmap["capture"]["activity"] == "walking"
        assert heatmap["capture"]["environment"] == "Casa A"
        assert heatmap["step_seconds"] == 0.25
        assert heatmap["column_count"] == 5
        assert [column["index"] for column in heatmap["columns"]] == [0, 2]
        amplitudes = heatmap["columns"][0]["relative_amplitudes"]
        assert len(amplitudes) == 55
        assert sum(amplitudes) / len(amplitudes) == pytest.approx(1)
        assert amplitudes[-1] == pytest.approx(2 * amplitudes[0])
        assert (await client.get(f"{path}/{capture_id}/preview")).json() == {"active": False, "heatmap": heatmap}
        assert (await client.get(path, params={"environment": "Casa B"})).json()["heatmaps"] == []

    # La agrupación para el gráfico no descarta paquetes de SQLite.
    history = await telemetry_repo.get_history("csi_router")
    assert len(history) == 5
    async with get_db_connection() as db:
        async with db.execute("SELECT * FROM telemetry ORDER BY id DESC LIMIT 2") as cursor:
            pir, csi = await cursor.fetchall()
    assert pir["raw_value"] == 1
    assert pir["amplitudes_json"] is None
    assert json.loads(csi["amplitudes_json"]) == sample.amplitudes
    assert csi["source"] == sample.source
    assert csi["sample_timestamp"] is None
    assert csi["features_json"] is not None
    assert csi["calibration_state"] == "sin_calibrar"


async def test_startup_adds_csi_columns_without_losing_old_telemetry():
    async with get_db_connection() as db:
        await db.execute("""
            CREATE TABLE telemetry (
                id INTEGER PRIMARY KEY AUTOINCREMENT, case_id TEXT, timestamp TEXT, presence INTEGER,
                raw_value REAL, latency_ms REAL, score REAL
            )
        """)
        await db.execute("INSERT INTO telemetry VALUES (1, 'csi_router', '2026-01-01', 0, 25, 0, NULL)")
        await db.commit()
    await init_db()
    await init_db()
    [record] = await telemetry_repo.get_history("csi_router")
    assert record.raw_value == 25
    async with get_db_connection() as db:
        async with db.execute("SELECT amplitudes_json, source FROM telemetry WHERE id = 1") as cursor:
            row = await cursor.fetchone()
    assert tuple(row) == (None, None)
