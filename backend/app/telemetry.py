import asyncio
import time

from app.constants import CaseId
from app.logging_config import logger
from app.mqtt import MQTTDataSource
from app.repositories.telemetry_repository import TelemetryRepository, telemetry_repo
from app.schemas.telemetry import CalibrationInfo, CsiRawSample, FeatureMetrics, SignalPoint, TelemetrySample
from app.signal_processing.presence_detector import CsiPresenceDetector
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
        # Un detector por caso CSI: cada enlace tiene su propia calibración.
        self.detectors = {
            CaseId.CSI_ROUTER: CsiPresenceDetector(),
            CaseId.CSI_DEDICATED: CsiPresenceDetector(),
        }
        self._tasks: list[asyncio.Task] = []
        self._stopping = asyncio.Event()
        self._refresh_calibration()

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
            score = float(presence)
        else:
            if not isinstance(sample, CsiRawSample):
                raise ValueError("Los casos CSI requieren amplitudes")
            result = self.detectors[case_id].process(time.monotonic(), sample.amplitudes)
            raw_value = result.mean_amplitude
            presence = result.presence
            features = self._build_features(case_id, result.movement_index, result.shape_index, result.detection_ratio)
            score = result.detection_ratio
            self.state.append_indicator_points(case_id, timestamp, features)
            self.state.set_calibration(case_id, self.calibration_info(case_id))

        self.state.append_raw_point(case_id, SignalPoint(timestamp=timestamp, value=raw_value))
        self.state.update_case_state(case_id, presence, sample.latency_ms, features)
        self.repository.enqueue(case_id, presence, raw_value, sample.latency_ms, score)

    def start_calibration(self, case_id: str, delay_seconds: float, duration_seconds: float) -> CalibrationInfo:
        self.detectors[case_id].start_calibration(time.monotonic(), delay_seconds, duration_seconds)
        info = self.calibration_info(case_id)
        self.state.set_calibration(case_id, info)
        return info

    def calibration_info(self, case_id: str) -> CalibrationInfo:
        detector = self.detectors[case_id]
        progress, seconds_remaining = detector.calibration_progress(time.monotonic())
        return CalibrationInfo(
            state=detector.state.value,
            message=detector.message,
            progress=round(progress, 3),
            seconds_remaining=round(seconds_remaining, 1),
        )

    def _build_features(self, case_id: str, movement: float | None, shape: float | None, ratio: float) -> FeatureMetrics:
        detector = self.detectors[case_id]
        return FeatureMetrics(
            movement_index=movement,
            movement_threshold=detector.movement_threshold,
            shape_index=shape,
            shape_threshold=detector.shape_threshold,
            detection_ratio=round(ratio, 3),
        )

    def _refresh_calibration(self) -> None:
        """La cuenta regresiva avanza aunque no lleguen paquetes."""
        for case_id in self.detectors:
            self.state.set_calibration(case_id, self.calibration_info(case_id))

    async def _broadcast_updates(self) -> None:
        while not await self._wait_for_shutdown(0.12):
            try:
                self._refresh_calibration()
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
