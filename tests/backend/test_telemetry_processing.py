import asyncio
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock

import pytest

from app.database import init_db
from app.repositories import telemetry_repository
from app.repositories.telemetry_repository import TelemetryRepository
from app.schemas.telemetry import CsiRawSample, TelemetrySample
from app.telemetry import TelemetryService
from app.telemetry_state import TelemetryState


async def test_pir_and_csi_samples_reach_state_and_storage():
    await init_db()
    state = TelemetryState(max_points=3)
    repository = TelemetryRepository()
    service = TelemetryService(state, repository)
    await service.handle_incoming_sample("pir", TelemetrySample(case_id="pir", presence=True, raw_value=1))
    for case_id in ("csi_router", "csi_dedicated"):
        for value in range(5):
            await service.handle_incoming_sample(case_id, CsiRawSample(case_id=case_id, amplitudes=[value, 99]))
        payload = state.get_payload(case_id)
        # raw_points guarda la amplitud media de cada paquete
        assert [point.value for point in payload.raw_points] == [50.5, 51, 51.5]
        assert len(payload.movement_points) == 1  # el indicador necesita 5 paquetes en la ventana
        assert payload.features is not None
        assert payload.calibration.state == "sin_calibrar"
        assert len(await repository.get_history(case_id)) == 5
    assert state.get_payload("pir").presence is True
    assert (await repository.get_history("pir"))[0].score == 1
    assert [status.total_samples for status in state.get_all_statuses()] == [1, 5, 5]


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
    repository.enqueue("pir", False, 0, 0)
    monkeypatch.setattr(telemetry_repository, "get_db_connection", real_connection)
    await asyncio.gather(repository.flush(), repository.flush())
    history = await repository.get_history("pir")
    assert [record.presence for record in history] == [False, True]


async def test_samples_arriving_during_commit_stay_pending(monkeypatch):
    repository = TelemetryRepository()
    repository.enqueue("pir", True, 1, 0)
    database = AsyncMock()

    async def commit():
        repository.enqueue("pir", False, 0, 0)

    database.commit.side_effect = commit

    @asynccontextmanager
    async def connection():
        yield database

    monkeypatch.setattr(telemetry_repository, "get_db_connection", connection)
    await repository.flush()
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
