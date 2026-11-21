from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db_connection, init_db
from app.main import app
from app.repositories.metrics_repository import metrics_repo
from app.repositories.telemetry_repository import telemetry_repo
from app.schemas.telemetry import CalibrationInfo
from app.telemetry import telemetry_service
from app.telemetry_state import TelemetryState

OBSERVED_AT = "2026-11-21T13:01:02.123-03:00"

@pytest.fixture
def state(monkeypatch):
    state = TelemetryState()
    monkeypatch.setattr(telemetry_service, "state", state)
    return state


@pytest.mark.parametrize(
    "case_id,scenario,detected,metric",
    [
        ("csi_router", "near_router", False, "false_negatives"),
        ("pir", "absent", True, "false_positives"),
    ],
)
async def test_live_observation_is_saved_with_environment_and_counted(state, case_id, scenario, detected, metric):
    await init_db()
    sample_key = telemetry_repo.enqueue(case_id, detected, 1, 52, calibration_state="calibrado")
    # Otra lectura ya llegó antes de que el servidor procese la marca.
    telemetry_repo.enqueue(case_id, not detected, 0, 90, calibration_state="calibrado")
    state.update_case_state(case_id, not detected, 90)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/metrics/trial/live", json={
            "case_id": case_id, "environment": " Casa A ", "scenario": scenario,
            "sample_key": sample_key, "observed_at": OBSERVED_AT,
        })
        assert response.status_code == 200
        trial = response.json()
        assert trial["environment"] == "Casa A"
        assert trial["scenario"] == scenario
        assert trial["latency_ms"] == 52
        assert trial["detected_presence"] is detected
        assert trial["is_correct"] is False
        assert trial["observed_at"] == "2026-11-21T16:01:02.123+00:00"
        sample = await telemetry_repo.get_trial_sample(case_id, sample_key)
        assert trial["sample_received_at"] == sample["timestamp"]
        assert trial["telemetry_id"] == sample["id"]
        assert (await client.get(f"/api/v1/metrics/{case_id}/trials")).json() == [trial]
        assert (await client.get(f"/api/v1/metrics/{case_id}")).json()[metric] == 1


def calibration(state):
    return CalibrationInfo(state=state, message="", progress=0, seconds_remaining=0)


async def test_csi_rejects_an_online_device_until_a_recent_calibrated_sample(state):
    await init_db()
    case_id = "csi_router"
    state.set_device_connection(case_id, True)
    state.update_case_state(case_id, False, 0)
    state.set_calibration(case_id, calibration("calibrado"))
    assert state.get_case_status(case_id).is_connected
    sample_key = telemetry_repo.enqueue(case_id, False, 1, 0, calibration_state="calibrando")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/metrics/trial/live", json={
            "case_id": case_id, "environment": "Casa B", "scenario": "absent",
            "sample_key": sample_key, "observed_at": OBSERVED_AT,
        })
    assert response.status_code == 409
    state.update_case_state(case_id, False, 0)
    assert state.get_case_status(case_id).can_record_trial
    state.set_calibration(case_id, calibration("calibrando"))
    assert not state.get_case_status(case_id).can_record_trial
    state.set_calibration(case_id, calibration("calibrado"))
    state.update_case_state(case_id, True, 0)
    state.get_case_status(case_id).last_updated = (datetime.now(timezone.utc) - timedelta(seconds=11)).isoformat()
    assert state.get_case_status(case_id).is_connected
    assert not state.get_case_status(case_id).can_record_trial


@pytest.mark.parametrize("environment,scenario", [("  ", "absent"), ("Casa A", "left_of_pir")])
async def test_pir_validates_environment_and_scenario(environment, scenario):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/metrics/trial/live", json={
            "case_id": "pir", "environment": environment, "scenario": scenario,
            "sample_key": "a" * 32, "observed_at": OBSERVED_AT,
        })
    assert response.status_code == 422


async def test_database_adds_environment_and_scenario_to_existing_trials():
    async with get_db_connection() as db:
        await db.execute("""
            CREATE TABLE trials (
                id INTEGER PRIMARY KEY AUTOINCREMENT, case_id TEXT, timestamp TEXT,
                ground_truth INTEGER, detected_presence INTEGER, is_correct INTEGER,
                latency_ms REAL, score REAL, notes TEXT
            )
        """)
        await db.execute("INSERT INTO trials VALUES (1, 'pir', '2026-01-01', 1, 1, 1, 90, NULL, 'Anterior')")
        await db.commit()
    await init_db()
    await init_db()
    [trial] = await metrics_repo.get_trials_by_case("pir")
    assert trial.notes == "Anterior"
    assert trial.environment is None
    assert trial.scenario is None
