import asyncio
from collections import deque
from datetime import datetime, timezone
from typing import Dict, List, Optional
from app.core.constants import CaseId, MAX_SERIES_POINTS
from app.core.logging import logger
from app.database.connection import get_db_connection
from app.schemas.telemetry import (
    SignalPoint,
    CaseCurrentStatus,
    FilterMetadata,
    FeatureMetrics,
    CaseTelemetryPayload,
    TelemetryHistoryRecord,
)


class InMemoryTelemetryRepository:
    """
    Buffer circular en memoria optimizado para retención de los últimos N puntos
    y cola de persistencia asíncrona hacia SQLite para trazabilidad histórica.
    Garantiza consultas en O(1) para el streaming de gráficos sin saturar SQLite.
    """

    def __init__(self, max_points: int = MAX_SERIES_POINTS):
        self.max_points = max_points
        self._raw_buffers: Dict[str, deque] = {
            CaseId.PIR.value: deque(maxlen=max_points),
            CaseId.CSI_ROUTER.value: deque(maxlen=max_points),
            CaseId.CSI_DEDICATED.value: deque(maxlen=max_points),
        }
        self._filtered_buffers: Dict[str, deque] = {
            CaseId.CSI_ROUTER.value: deque(maxlen=max_points),
            CaseId.CSI_DEDICATED.value: deque(maxlen=max_points),
        }
        self._current_statuses: Dict[str, CaseCurrentStatus] = {
            CaseId.PIR.value: CaseCurrentStatus(
                case_id=CaseId.PIR,
                name="Caso 1 — Sensor PIR",
                is_connected=True,
                presence=False,
                current_latency_ms=145.0,
                last_updated=datetime.now(timezone.utc).isoformat(),
                total_samples=0,
            ),
            CaseId.CSI_ROUTER.value: CaseCurrentStatus(
                case_id=CaseId.CSI_ROUTER,
                name="Caso 2 — CSI con Router Wi-Fi",
                is_connected=True,
                presence=False,
                current_latency_ms=318.0,
                last_updated=datetime.now(timezone.utc).isoformat(),
                total_samples=0,
            ),
            CaseId.CSI_DEDICATED.value: CaseCurrentStatus(
                case_id=CaseId.CSI_DEDICATED,
                name="Caso 3 — CSI en Red Dedicada (AP-STA)",
                is_connected=True,
                presence=False,
                current_latency_ms=395.0,
                last_updated=datetime.now(timezone.utc).isoformat(),
                total_samples=0,
            ),
        }
        self._latest_features: Dict[str, FeatureMetrics] = {}
        self._latest_filter_meta: Dict[str, FilterMetadata] = {}
        self._pending_persists: List[tuple] = []
        self._persist_lock = asyncio.Lock()

    def append_raw_point(self, case_id: str, point: SignalPoint):
        if case_id in self._raw_buffers:
            self._raw_buffers[case_id].append(point)

    def append_filtered_point(self, case_id: str, point: SignalPoint):
        if case_id in self._filtered_buffers:
            self._filtered_buffers[case_id].append(point)

    def update_case_state(
        self,
        case_id: str,
        presence: bool,
        latency_ms: float,
        filter_meta: Optional[FilterMetadata] = None,
        features: Optional[FeatureMetrics] = None,
    ):
        if case_id in self._current_statuses:
            status = self._current_statuses[case_id]
            status.presence = presence
            status.current_latency_ms = round(latency_ms, 1)
            status.last_updated = datetime.now(timezone.utc).isoformat()
            status.total_samples += 1

        if filter_meta:
            self._latest_filter_meta[case_id] = filter_meta
        if features:
            self._latest_features[case_id] = features

    def queue_telemetry_for_persistence(
        self,
        case_id: str,
        presence: bool,
        raw_value: float,
        latency_ms: float,
        score: Optional[float] = None,
    ):
        """Encola una muestra para escritura diferida en SQLite."""
        now_iso = datetime.now(timezone.utc).isoformat()
        self._pending_persists.append((
            case_id,
            now_iso,
            1 if presence else 0,
            float(raw_value),
            float(latency_ms),
            float(score) if score is not None else None,
        ))

    async def flush_persisted(self):
        """Escribe las muestras acumuladas en la base SQLite mediante batching."""
        if not self._pending_persists:
            return

        async with self._persist_lock:
            to_save = self._pending_persists[:]
            self._pending_persists.clear()

        if not to_save:
            return

        try:
            async with get_db_connection() as db:
                await db.executemany(
                    """
                    INSERT INTO telemetry (case_id, timestamp, presence, raw_value, latency_ms, score)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    to_save,
                )
                await db.commit()
        except Exception as e:
            logger.error(f"Error al escribir lote de telemetría en SQLite: {e}")

    async def get_persisted_history(self, case_id: str, limit: int = 50) -> List[TelemetryHistoryRecord]:
        """Recupera el historial de telemetría persistido en SQLite para un caso."""
        await self.flush_persisted()
        async with get_db_connection() as db:
            cursor = await db.execute(
                """
                SELECT id, case_id, timestamp, presence, raw_value, latency_ms, score
                FROM telemetry
                WHERE case_id = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (case_id, limit),
            )
            rows = await cursor.fetchall()
            return [
                TelemetryHistoryRecord(
                    id=row["id"],
                    case_id=row["case_id"],
                    timestamp=row["timestamp"],
                    presence=bool(row["presence"]),
                    raw_value=float(row["raw_value"]),
                    latency_ms=float(row["latency_ms"]),
                    score=float(row["score"]) if row["score"] is not None else None,
                )
                for row in rows
            ]

    def get_raw_points(self, case_id: str) -> List[SignalPoint]:
        buf = self._raw_buffers.get(case_id, deque())
        return list(buf)

    def get_filtered_points(self, case_id: str) -> List[SignalPoint]:
        buf = self._filtered_buffers.get(case_id, deque())
        return list(buf)

    def get_all_statuses(self) -> List[CaseCurrentStatus]:
        return list(self._current_statuses.values())

    def get_status(self, case_id: str) -> Optional[CaseCurrentStatus]:
        return self._current_statuses.get(case_id)

    def get_payload(self, case_id: str) -> CaseTelemetryPayload:
        status = self._current_statuses.get(case_id)
        presence = status.presence if status else False
        latency_ms = status.current_latency_ms if status else 0.0

        features = self._latest_features.get(case_id)
        current_score = features.detection_score if features else (1.0 if presence else 0.0)

        return CaseTelemetryPayload(
            case_id=case_id,
            presence=presence,
            latency_ms=latency_ms,
            raw_points=self.get_raw_points(case_id)[-100:],
            filtered_points=self.get_filtered_points(case_id)[-100:] if case_id != CaseId.PIR.value else None,
            filter_metadata=self._latest_filter_meta.get(case_id),
            features=features,
            current_score=current_score,
        )


telemetry_repo = InMemoryTelemetryRepository()
