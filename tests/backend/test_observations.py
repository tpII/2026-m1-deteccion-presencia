from datetime import datetime, timedelta, timezone
import json
from types import SimpleNamespace

from httpx import ASGITransport, AsyncClient
import pytest

from app import telemetry
from app.api import observations
from app.database import get_db_connection, init_db
from app.main import app
from app.repositories import calibration_repository
from app.repositories.telemetry_repository import TelemetryRepository
from app.schemas.telemetry import CsiRawSample, TelemetrySample
from app.telemetry_state import TelemetryState


class ExperimentClock(datetime):
    base = datetime(2026, 11, 21, 15, tzinfo=timezone.utc)
    elapsed = 0.0

    @classmethod
    def now(cls, tz):
        return (cls.base + timedelta(seconds=cls.elapsed)).astimezone(tz)


@pytest.fixture
async def service(monkeypatch):
    await init_db()
    ExperimentClock.elapsed = 0.0
    monkeypatch.setattr(telemetry, "datetime", ExperimentClock)
    monkeypatch.setattr(telemetry, "time", SimpleNamespace(monotonic=lambda: ExperimentClock.elapsed))
    monkeypatch.setattr(calibration_repository, "datetime", ExperimentClock)
    service = telemetry.TelemetryService(TelemetryState(), TelemetryRepository())
    monkeypatch.setattr(observations, "telemetry_service", service)
    return service


async def mark(client, case_id, scenario, seconds, environment="Casa A"):
    observed_at = ExperimentClock.base + timedelta(seconds=seconds)
    response = await client.post("/api/v1/observations", json={
        "case_id": case_id, "environment": environment, "scenario": scenario,
        "observed_at": observed_at.isoformat(timespec="milliseconds"),
    })
    assert response.status_code == 201
    return response.json()


async def pir_sample(service, seconds, presence):
    ExperimentClock.elapsed = seconds
    await service.handle_incoming_sample("pir", TelemetrySample(case_id="pir", presence=presence, raw_value=int(presence)))


async def test_marks_apply_to_subsequent_samples_even_if_database_write_arrived_later(service):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await pir_sample(service, 0.9, True)
        await pir_sample(service, 1.1, True)
        await pir_sample(service, 1.2, False)
        await pir_sample(service, 1.3, False)
        absent = await mark(client, "pir", "absent", 1)
        present = await mark(client, "pir", "present", 1.25)
        stopped = await mark(client, "pir", None, 1.4)
        await pir_sample(service, 1.5, False)
        old_run = service.run_id
        await mark(client, "pir", "absent", 1.6, environment="Casa B")
        await pir_sample(service, 1.7, True)
        service.run_id = "restart"
        await pir_sample(service, 1.8, True)

        report = (await client.get("/api/v1/observations/pir", params={"environment": "Casa A"})).json()
        assert [item["id"] for item in report["marks"]] == [stopped["id"], present["id"], absent["id"]]
        assert [(item["observation_id"], item["result"]) for item in report["samples"]] == [
            (present["id"], "false_negative"), (absent["id"], "correct"), (absent["id"], "false_positive"),
        ]
        report = (await client.get("/api/v1/observations/pir", params={"environment": "Casa B"})).json()
        assert [item["result"] for item in report["samples"]] == ["false_positive"]
        assert old_run != service.run_id


async def calibrate(service, seconds, amplitudes):
    ExperimentClock.elapsed = seconds
    await service.start_calibration("csi_router", 0, 10, "Casa A")
    for index in range(52):
        ExperimentClock.elapsed = seconds + (index + 1) / 10
        await service.handle_incoming_sample("csi_router", CsiRawSample(case_id="csi_router", amplitudes=amplitudes))
    ExperimentClock.elapsed = seconds + 10
    assert service.calibration_info("csi_router").state == "calibrado"


async def test_successful_profiles_persist_and_counts_are_separated_by_calibration(service):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await calibrate(service, 0, [2, 4] * 27 + [2])
        await mark(client, "pir", "absent", 10.1)
        await pir_sample(service, 10.2, True)
        await pir_sample(service, 10.3, True)
        await calibrate(service, 20, [3, 1] * 27 + [3])
        await pir_sample(service, 30.1, True)  # No cuenta la marca de la calibración anterior.
        await mark(client, "pir", "present", 30.2)
        await pir_sample(service, 30.3, False)
        await mark(client, "csi_router", "left_of_pir", 30.25)
        await service.handle_incoming_sample("csi_router", CsiRawSample(case_id="csi_router", amplitudes=[3, 1] * 27 + [3]))

        pir_report = (await client.get("/api/v1/observations/pir", params={"environment": "Casa A"})).json()
        newest, oldest = pir_report["calibrations"]
        assert (oldest["evaluated"], oldest["false_positives"], oldest["false_negatives"]) == (2, 2, 0)
        assert (newest["evaluated"], newest["false_positives"], newest["false_negatives"]) == (1, 0, 1)
        csi_report = (await client.get("/api/v1/observations/csi_router", params={"environment": "Casa A"})).json()
        assert csi_report["calibrations"][0]["evaluated"] == 1
        assert csi_report["samples"][0]["scenario"] == "left_of_pir"

    async with get_db_connection() as db:
        async with db.execute("SELECT * FROM csi_calibration_events ORDER BY id") as cursor:
            first, second = await cursor.fetchall()
    for calibration in (first, second):
        profile = json.loads(calibration["profile_json"])
        assert len(profile) == 55
        assert sum(profile) / len(profile) == pytest.approx(1)
        assert calibration["movement_threshold"] is not None
        assert calibration["shape_threshold"] is not None
        assert calibration["sample_count"] == 52
        assert calibration["finished_at"] > calibration["started_at"]
    assert first["profile_json"] != second["profile_json"]


async def test_failed_calibration_is_recorded_without_overwriting_a_previous_profile(service):
    await calibrate(service, 0, [2, 4] * 27 + [2])
    ExperimentClock.elapsed = 20
    await service.start_calibration("csi_router", 0, 10, "Casa A")
    ExperimentClock.elapsed = 30
    service.calibration_info("csi_router")
    await pir_sample(service, 30.1, True)
    await service.repository.flush()
    async with get_db_connection() as db:
        async with db.execute("SELECT id, outcome, profile_json, sample_count FROM csi_calibration_events ORDER BY id") as cursor:
            first, second = await cursor.fetchall()
        async with db.execute("SELECT calibration_id FROM telemetry WHERE case_id = 'pir'") as cursor:
            sample = await cursor.fetchone()
    assert first["outcome"] == "exitosa"
    assert first["profile_json"]
    assert second["outcome"] == "fallida"
    assert second["profile_json"] is None
    assert second["sample_count"] == 0
    assert sample["calibration_id"] == first["id"]
