import asyncio
import time

from app.constants import CaseId
from app.logging_config import logger
from app.mqtt import MQTTDataSource
from app.repositories.telemetry_repository import TelemetryRepository, telemetry_repo
from app.schemas.telemetry import CsiRawSample, SignalPoint, TelemetrySample
from app.signal_processing.pipeline import CsiSignalPipeline
from app.telemetry_state import TelemetryState, telemetry_state
from app.websocket import ws_manager


class TelemetryService:
    def __init__(
        self,
        state: TelemetryState = telemetry_state,
        repository: TelemetryRepository = telemetry_repo,
    ):
        self.state = state
        self.repository = repository
        self.data_source: MQTTDataSource | None = None
        self._pipelines = {
            CaseId.CSI_ROUTER: CsiSignalPipeline(variance_threshold=2.2),
            CaseId.CSI_DEDICATED: CsiSignalPipeline(variance_threshold=1.8),
        }
        self._tasks: list[asyncio.Task] = []
        self._stopping = asyncio.Event()

    async def initialize(self) -> None:
        self._stopping.clear()
        self.data_source = MQTTDataSource()
        self.data_source.set_sample_handler(self.handle_incoming_sample)
        await self.data_source.start()
        self._tasks = [
            asyncio.create_task(self._broadcast_updates()),
            asyncio.create_task(self._persist_samples()),
        ]

    async def shutdown(self) -> None:
        self._stopping.set()
        if self.data_source:
            await self.data_source.stop()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        await self.repository.flush()

    async def handle_incoming_sample(self, case_id: str, sample: TelemetrySample | CsiRawSample) -> None:
        timestamp = time.time() * 1000
        if case_id == CaseId.PIR:
            if not isinstance(sample, TelemetrySample):
                raise ValueError("El caso PIR requiere una muestra digital")
            raw_value = sample.raw_value
            presence = sample.presence
            features = None
            filter_metadata = None
            score = float(presence)
            self.state.append_raw_point(case_id, SignalPoint(timestamp=timestamp, value=raw_value))
        else:
            if not isinstance(sample, CsiRawSample):
                raise ValueError("Los casos CSI requieren amplitudes")
            pipeline = self._pipelines[case_id]
            raw_value = sample.amplitudes[0]
            self.state.append_raw_point(case_id, SignalPoint(timestamp=timestamp, value=raw_value))
            window = [point.value for point in self.state.get_raw_points(case_id)[-30:]]
            filtered, features, presence = pipeline.process_window(window)
            self.state.append_filtered_point(case_id, SignalPoint(timestamp=timestamp, value=filtered[-1]))
            filter_metadata = pipeline.get_filter_metadata()
            score = features.detection_score

        self.state.update_case_state(case_id, presence, sample.latency_ms, filter_metadata, features)
        self.repository.enqueue(case_id, presence, raw_value, sample.latency_ms, score)

    async def _broadcast_updates(self) -> None:
        while not await self._wait_for_shutdown(0.12):
            try:
                if ws_manager.client_count:
                    await ws_manager.broadcast_json(self.state.get_message("telemetry_batch"))
            except Exception:
                logger.exception("No se pudo emitir la telemetría por WebSocket")

    async def _persist_samples(self) -> None:
        while not await self._wait_for_shutdown(2):
            try:
                await self.repository.flush()
            except Exception:
                logger.exception("No se pudo guardar la telemetría; el lote sigue pendiente")

    async def _wait_for_shutdown(self, timeout: float) -> bool:
        try:
            await asyncio.wait_for(self._stopping.wait(), timeout)
            return True
        except TimeoutError:
            return False


telemetry_service = TelemetryService()
