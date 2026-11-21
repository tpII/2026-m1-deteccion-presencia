import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest

from app.database import init_db
from app.repositories import telemetry_repository
from app.repositories.telemetry_repository import TelemetryRepository
from app.schemas.telemetry import CalibrationInfo, CsiRawSample, TelemetrySample
from app.telemetry import TelemetryService
from app.telemetry_state import TelemetryState


def test_csi_readiness_requires_a_recent_calibrated_sample():
    state = TelemetryState()
    case_id = "csi_router"
    state.set_device_connection(case_id, True)
    state.update_case_state(case_id, False, 0)
    calibrated = CalibrationInfo(state="calibrado", message="", progress=1, seconds_remaining=0)
    state.set_calibration(case_id, calibrated)
    assert not state.get_case_status(case_id).can_record_trial
    state.update_case_state(case_id, False, 0)
    assert state.get_case_status(case_id).can_record_trial
    state.set_calibration(case_id, calibrated.model_copy(update={"state": "calibrando"}))
    assert not state.get_case_status(case_id).can_record_trial
    state.set_calibration(case_id, calibrated)
    state.update_case_state(case_id, True, 0)
    status = state.get_case_status(case_id, datetime.now(timezone.utc) + timedelta(seconds=11))
    assert status.is_connected
    assert not status.can_record_trial


async def test_pir_and_csi_samples_reach_state_and_storage():
    await init_db()
    state = TelemetryState(max_points=3)
    repository = TelemetryRepository()
    service = TelemetryService(state, repository)
    await service.handle_incoming_sample("pir", TelemetrySample(case_id="pir", presence=True, raw_value=1))
    for value in range(5):
        await service.handle_incoming_sample("csi_router", CsiRawSample(case_id="csi_router", amplitudes=[value, 99]))
    payload = state.get_payload("csi_router")
    assert [point.value for point in payload.raw_points] == [50.5, 51, 51.5]
    assert len(payload.movement_points) == 1  # el indicador necesita 5 paquetes en la ventana
    assert payload.features is not None
    assert payload.calibration.state == "sin_calibrar"
    assert len(await repository.get_history("csi_router")) == 5
    assert state.get_payload("pir").presence is True
    assert (await repository.get_history("pir"))[0].score == 1
    assert [status.total_samples for status in state.get_all_statuses()] == [1, 5]


async def test_failed_write_can_be_retried_without_losing_samples(monkeypatch):
    await init_db()
    repository = TelemetryRepository()
    repository.enqueue("pir", True, 1, 0)
    real_connection = telemetry_repository.get_db_connection

    @asynccontextmanager
    async def failing_connection():
        raise OSError("Disco no disponible")
        yield

    monkeypatch.setattr(telemetry_repository, "get_db_connection", failing_connection)
    with pytest.raises(OSError):
        await repository.flush()
    failed = repository.get_persistence_stats()
    assert failed["failed_writes"] == 1
    assert failed["pending_samples"] == 1
    assert failed["committed_samples"] == 0
    repository.enqueue("pir", False, 0, 0)
    monkeypatch.setattr(telemetry_repository, "get_db_connection", real_connection)
    await asyncio.gather(repository.flush(), repository.flush())
    history = await repository.get_history("pir")
    assert [record.presence for record in history] == [False, True]
    recovered = repository.get_persistence_stats()
    assert recovered["failed_writes"] == 1
    assert recovered["pending_samples"] == 0
    assert recovered["committed_samples"] == 2
    assert recovered["timed_batches"] == 1


async def test_samples_arriving_during_commit_stay_pending(monkeypatch):
    clock = 1.0
    monkeypatch.setattr(telemetry_repository, "monotonic", lambda: clock)
    repository = TelemetryRepository()
    repository.enqueue("pir", True, 1, 0)
    database = AsyncMock()

    async def commit():
        nonlocal clock
        clock = 3.005
        repository.enqueue("pir", False, 0, 0)

    database.commit.side_effect = commit

    @asynccontextmanager
    async def connection():
        yield database

    monkeypatch.setattr(telemetry_repository, "get_db_connection", connection)
    clock = 3.0
    assert repository.get_persistence_stats()["oldest_pending_ms"] == 2000
    await repository.flush()
    stats = repository.get_persistence_stats()
    assert stats["pending_samples"] == 1
    assert stats["oldest_pending_ms"] == 0
    assert stats["last_batch_size"] == 1
    assert stats["last_write_ms"] == 5
    assert stats["p95_write_ms"] == 5
    assert stats["last_oldest_to_commit_ms"] == 2005
    database.commit.side_effect = None
    await repository.flush()
    assert [call.args[1][0][2] for call in database.executemany.call_args_list] == [1, 0]


async def test_shutdown_drains_mqtt_before_final_flush():
    source = AsyncMock()
    repository = AsyncMock()
    service = TelemetryService(TelemetryState(), repository)
    service.data_source = source
    order = []
    source.stop.side_effect = lambda: order.append("stop")
    repository.flush.side_effect = lambda: order.append("flush")
    await service.shutdown()
    assert order == ["stop", "flush"]
