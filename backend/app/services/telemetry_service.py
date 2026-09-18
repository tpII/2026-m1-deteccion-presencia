"""Servicio principal de orquestación de telemetría y procesamiento de señal."""

import asyncio
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from app.core.config import settings
from app.core.constants import CaseId, DataSourceType
from app.data_sources.base import DataSource
from app.data_sources.mock_source import MockDataSource
from app.data_sources.mqtt_source import MQTTDataSource
from app.signal_processing.pipeline import CsiSignalPipeline
from app.repositories.telemetry_repository import telemetry_repo
from app.services.websocket_manager import ws_manager
from app.schemas.telemetry import SignalPoint, TelemetrySample, CsiRawSample
from app.schemas.websocket import WebSocketMessage, BatchUpdatePayload
from app.core.logging import logger


class TelemetryService:
    """
    Coordina la ingesta de datos desde la fuente configurada,
    el paso por los pipelines de filtrado y extracción,
    la actualización de repositorios y el despacho por WebSockets.
    """

    def __init__(self):
        self.data_source: Optional[DataSource] = None
        # Pipelines independientes para Caso 2 y Caso 3 (permiten sintonía fina diferenciada)
        self.router_pipeline = CsiSignalPipeline(
            hampel_window=7,
            hampel_sigmas=3.0,
            ma_window=5,
            variance_threshold=2.2,
        )
        self.dedicated_pipeline = CsiSignalPipeline(
            hampel_window=7,
            hampel_sigmas=3.0,
            ma_window=5,
            variance_threshold=1.8,
        )
        self._broadcast_task: Optional[asyncio.Task] = None
        self._running = False

    async def initialize(self):
        """Inicializa la fuente de datos (Mock o MQTT) y el bucle de difusión WebSocket."""
        if settings.DATA_SOURCE.lower() == DataSourceType.MQTT.value:
            logger.info("Inicializando DataSource en modo MQTT (hardware)...")
            self.data_source = MQTTDataSource()
        else:
            logger.info("Inicializando DataSource en modo MOCK (simulación interna)...")
            self.data_source = MockDataSource(sampling_rate_hz=10.0)

        self.data_source.set_sample_handler(self.handle_incoming_sample)
        await self.data_source.start()

        self._running = True
        self._broadcast_task = asyncio.create_task(self._websocket_broadcast_loop())

    async def shutdown(self):
        """Detiene de forma limpia los bucles y conexiones."""
        self._running = False
        if self.data_source:
            await self.data_source.stop()
        if self._broadcast_task:
            self._broadcast_task.cancel()
            try:
                await self._broadcast_task
            except asyncio.CancelledError:
                pass
        # Vaciar cualquier muestra pendiente en SQLite
        await telemetry_repo.flush_persisted()

    def pause_simulation(self):
        if isinstance(self.data_source, MockDataSource):
            self.data_source.pause()

    def resume_simulation(self):
        if isinstance(self.data_source, MockDataSource):
            self.data_source.resume()

    @property
    def is_simulation_paused(self) -> bool:
        if isinstance(self.data_source, MockDataSource):
            return self.data_source.is_paused
        return False

    async def handle_incoming_sample(self, case_id: str, sample: Any):
        """
        Procesa una muestra individual recibida de la fuente de datos.
        Aplica validación, pipeline de filtrado, decisión de presencia y encola persistencia SQLite.
        """
        now_ms = time.time() * 1000

        if case_id == CaseId.PIR.value:
            # Caso 1: PIR Digital (0 o 1)
            if isinstance(sample, TelemetrySample):
                pt = SignalPoint(timestamp=now_ms, value=sample.raw_value)
                telemetry_repo.append_raw_point(case_id, pt)
                telemetry_repo.update_case_state(
                    case_id=case_id,
                    presence=sample.presence,
                    latency_ms=sample.latency_ms,
                )
                telemetry_repo.queue_telemetry_for_persistence(
                    case_id=case_id,
                    presence=sample.presence,
                    raw_value=sample.raw_value,
                    latency_ms=sample.latency_ms,
                    score=1.0 if sample.presence else 0.0,
                )

        elif case_id in (CaseId.CSI_ROUTER.value, CaseId.CSI_DEDICATED.value):
            # Casos 2 y 3: CSI continuo
            pipeline = self.router_pipeline if case_id == CaseId.CSI_ROUTER.value else self.dedicated_pipeline
            raw_val = sample.amplitudes[0] if sample.amplitudes else 0.0

            # Almacenar punto crudo en buffer circular
            raw_pt = SignalPoint(timestamp=now_ms, value=raw_val)
            telemetry_repo.append_raw_point(case_id, raw_pt)

            # Tomar ventana de últimos puntos para procesar
            history_pts = telemetry_repo.get_raw_points(case_id)
            signal_window = [p.value for p in history_pts[-30:]]

            # Procesamiento a través del pipeline (Hampel -> MA -> Varianza -> Score)
            filtered_vals, features, presence = pipeline.process_window(signal_window)
            latest_filtered = filtered_vals[-1] if filtered_vals else raw_val

            # Almacenar punto filtrado
            filtered_pt = SignalPoint(timestamp=now_ms, value=latest_filtered)
            telemetry_repo.append_filtered_point(case_id, filtered_pt)

            # Actualizar estado instantáneo
            telemetry_repo.update_case_state(
                case_id=case_id,
                presence=presence,
                latency_ms=sample.latency_ms,
                filter_meta=pipeline.get_filter_metadata(),
                features=features,
            )

            # Encolar persistencia histórica en SQLite
            telemetry_repo.queue_telemetry_for_persistence(
                case_id=case_id,
                presence=presence,
                raw_value=raw_val,
                latency_ms=sample.latency_ms,
                score=features.detection_score,
            )

    async def _websocket_broadcast_loop(self):
        """
        Emite actualizaciones agregadas por WebSocket a una tasa controlada (~8 Hz)
        y ejecuta el vaciado periódico diferido hacia SQLite.
        """
        interval = 0.12  # ~8 updates por segundo
        ticks = 0
        while self._running:
            try:
                ticks += 1
                if ws_manager.client_count > 0:
                    statuses = telemetry_repo.get_all_statuses()
                    cases_payload = {
                        CaseId.PIR.value: telemetry_repo.get_payload(CaseId.PIR.value).model_dump(),
                        CaseId.CSI_ROUTER.value: telemetry_repo.get_payload(CaseId.CSI_ROUTER.value).model_dump(),
                        CaseId.CSI_DEDICATED.value: telemetry_repo.get_payload(CaseId.CSI_DEDICATED.value).model_dump(),
                    }

                    message = {
                        "type": "telemetry_batch",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "data": {
                            "statuses": [s.model_dump() for s in statuses],
                            "cases": cases_payload,
                        },
                    }
                    await ws_manager.broadcast_json(message)

                # Persistencia periódica por lotes en SQLite (~cada 2 segundos)
                if ticks % 16 == 0:
                    await telemetry_repo.flush_persisted()

                await asyncio.sleep(interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error en broadcast WebSocket o persistencia: {e}")
                await asyncio.sleep(1.0)


telemetry_service = TelemetryService()
