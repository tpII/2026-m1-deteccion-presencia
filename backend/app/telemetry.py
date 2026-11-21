import asyncio
from datetime import datetime, timezone
import time
from uuid import uuid4

from app.calibration_tracking import CalibrationTracking
from app.constants import TELEMETRY_FLUSH_INTERVAL_SECONDS, CaseId
from app.logging_config import logger
from app.mqtt import MQTTDataSource
from app.repositories.calibration_repository import close_interrupted_calibrations, record_start
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
        self.run_id = uuid4().hex
        self.calibrations = CalibrationTracking(repository)
        self._calibration_lock = asyncio.Lock()
        self.data_source: MQTTDataSource | None = None
        self.detector = CsiPresenceDetector()
        self._tasks: list[asyncio.Task] = []
        self._stopping = asyncio.Event()
        self._refresh_calibration()

    async def initialize(self) -> None:
        self._stopping.clear()
        self.run_id = uuid4().hex
        await close_interrupted_calibrations()
        self.data_source = MQTTDataSource()
        self.data_source.set_sample_handler(self.handle_incoming_sample)
        self.data_source.set_status_handler(self.state.set_device_connection)
        self.data_source.set_connection_handler(self.state.set_broker_connection)
        self.state.set_broker_connection(False)
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
        received_at = datetime.now(timezone.utc)
        timestamp = received_at.timestamp() * 1000
        calibration_state = None
        if case_id == CaseId.PIR:
            if not isinstance(sample, TelemetrySample):
                raise ValueError("El caso PIR requiere una muestra digital")
            raw_value = sample.raw_value
            presence = sample.presence
            features = None
            score = float(presence)
        else:
            if not isinstance(sample, CsiRawSample):
                raise ValueError("El caso CSI requiere amplitudes")
            detector = self.detector
            now = time.monotonic()
            detector.calibration_progress(now)
            self.calibrations.check_completion(detector, received_at)
            result = detector.process(now, sample.amplitudes)
            raw_value = result.mean_amplitude
            presence = result.presence
            features = self._build_features(result.movement_index, result.shape_index, result.detection_ratio)
            score = result.detection_ratio
            self.state.append_indicator_points(case_id, timestamp, features)
            calibration = self.calibration_info()
            calibration_state = calibration.state
            self.state.set_calibration(case_id, calibration)

        self.state.append_raw_point(case_id, SignalPoint(timestamp=timestamp, value=raw_value))
        calibration_id = self.calibrations.effective_id(self.detector)
        self.repository.enqueue(
            case_id, presence, raw_value, sample.latency_ms, score,
            sample=sample, features=features, calibration_state=calibration_state,
            received_at=received_at.isoformat(timespec="microseconds"),
            run_id=self.run_id, calibration_id=calibration_id,
        )
        self.state.update_case_state(case_id, presence, sample.latency_ms, features)

    async def start_calibration(
        self, delay_seconds: float, duration_seconds: float, environment: str,
    ) -> CalibrationInfo:
        async with self._calibration_lock:
            event_id = await record_start(environment)
            self.calibration_info()
            self.calibrations.start(event_id, datetime.now(timezone.utc))
            self.detector.start_calibration(time.monotonic(), delay_seconds, duration_seconds)
            info = self.calibration_info()
            self.state.set_calibration(CaseId.CSI_ROUTER, info)
            return info

    def calibration_info(self) -> CalibrationInfo:
        detector = self.detector
        progress, seconds_remaining = detector.calibration_progress(time.monotonic())
        self.calibrations.check_completion(detector, datetime.now(timezone.utc))
        return CalibrationInfo(
            state=detector.state.value,
            message=detector.message,
            progress=round(progress, 3),
            seconds_remaining=round(seconds_remaining, 1),
        )

    def _build_features(self, movement: float | None, shape: float | None, ratio: float) -> FeatureMetrics:
        detector = self.detector
        return FeatureMetrics(
            movement_index=movement,
            movement_threshold=detector.movement_threshold,
            shape_index=shape,
            shape_threshold=detector.shape_threshold,
            detection_ratio=round(ratio, 3),
        )

    def _refresh_calibration(self) -> None:
        """La cuenta regresiva avanza aunque no lleguen paquetes."""
        self.state.set_calibration(CaseId.CSI_ROUTER, self.calibration_info())

    async def _broadcast_updates(self) -> None:
        while not await self._wait_for_shutdown(0.12):
            try:
                self._refresh_calibration()
                if ws_manager.client_count:
                    await ws_manager.broadcast_json(self.state.get_message("telemetry_batch"))
            except Exception:
                logger.exception("No se pudo emitir la telemetría por WebSocket")

    async def _persist_samples(self) -> None:
        while not await self._wait_for_shutdown(TELEMETRY_FLUSH_INTERVAL_SECONDS):
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
