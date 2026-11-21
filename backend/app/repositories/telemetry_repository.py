import asyncio
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
import json
from math import ceil
from time import monotonic
from uuid import uuid4

from app.constants import TELEMETRY_FLUSH_INTERVAL_SECONDS
from app.database import get_db_connection
from app.schemas.telemetry import CsiRawSample, FeatureMetrics, TelemetryHistoryRecord, TelemetrySample


@dataclass
class PendingSample:
    values: tuple
    queued_at: float


class TelemetryRepository:
    def __init__(self):
        self._pending: list[PendingSample] = []
        self._pending_calibrations: list[tuple] = []
        self._flush_lock = asyncio.Lock()
        self._write_durations_ms: deque[float] = deque(maxlen=100)
        self._committed_samples = 0
        self._failed_writes = 0
        self._last_batch_size: int | None = None
        self._last_oldest_to_commit_ms: float | None = None

    def enqueue(
        self,
        case_id: str,
        presence: bool,
        raw_value: float,
        latency_ms: float,
        score: float | None = None,
        *,
        sample: TelemetrySample | CsiRawSample | None = None,
        features: FeatureMetrics | None = None,
        calibration_state: str | None = None,
        received_at: str | None = None,
        run_id: str | None = None,
        calibration_id: int | None = None,
    ) -> str:
        sample_key = uuid4().hex
        values = (
            case_id,
            received_at or datetime.now(timezone.utc).isoformat(timespec="microseconds"),
            int(presence),
            raw_value,
            latency_ms,
            score,
            sample.source if sample else None,
            sample.timestamp if sample and "timestamp" in sample.model_fields_set else None,
            sample.ground_truth if sample else None,
            json.dumps(sample.amplitudes, separators=(",", ":")) if isinstance(sample, CsiRawSample) else None,
            features.model_dump_json() if features else None,
            calibration_state,
            sample_key,
            run_id,
            calibration_id,
        )
        self._pending.append(PendingSample(values, monotonic()))
        return sample_key

    def enqueue_calibration(self, event_id, finished_at, outcome, profile, movement, shape, count):
        self._pending_calibrations.append((finished_at, outcome, profile, movement, shape, count, event_id))

    async def flush(self) -> None:
        async with self._flush_lock:
            batch = self._pending[:]
            calibrations = self._pending_calibrations[:]
            if not batch and not calibrations:
                return
            started = monotonic()
            try:
                async with get_db_connection() as db:
                    if calibrations:
                        await db.executemany("""
                            UPDATE csi_calibration_events SET finished_at = ?, outcome = ?, profile_json = ?,
                                movement_threshold = ?, shape_threshold = ?, sample_count = ? WHERE id = ?
                        """, calibrations)
                    if batch:
                        await db.executemany("""
                            INSERT INTO telemetry (case_id, timestamp, presence, raw_value, latency_ms, score,
                                           source, sample_timestamp, ground_truth, amplitudes_json,
                                           features_json, calibration_state, sample_key, run_id, calibration_id)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, [sample.values for sample in batch])
                    await db.commit()
                    committed_at = monotonic()
                    del self._pending[:len(batch)]
                    del self._pending_calibrations[:len(calibrations)]
                    if batch:
                        self._write_durations_ms.append((committed_at - started) * 1000)
                        self._committed_samples += len(batch)
                        self._last_batch_size = len(batch)
                        self._last_oldest_to_commit_ms = round((committed_at - batch[0].queued_at) * 1000, 2)
            except Exception:
                self._failed_writes += 1
                raise

    def get_persistence_stats(self) -> dict:
        durations = sorted(self._write_durations_ms)
        oldest_age_ms = (monotonic() - self._pending[0].queued_at) * 1000 if self._pending else None
        return {
            "flush_interval_seconds": TELEMETRY_FLUSH_INTERVAL_SECONDS,
            "pending_samples": len(self._pending),
            "pending_calibrations": len(self._pending_calibrations),
            "committed_samples": self._committed_samples,
            "failed_writes": self._failed_writes,
            "oldest_pending_ms": round(oldest_age_ms, 2) if oldest_age_ms is not None else None,
            "last_batch_size": self._last_batch_size,
            "last_write_ms": round(self._write_durations_ms[-1], 2) if durations else None,
            "p95_write_ms": round(durations[ceil(0.95 * len(durations)) - 1], 2) if durations else None,
            "timed_batches": len(durations),
            "last_oldest_to_commit_ms": self._last_oldest_to_commit_ms,
        }

    async def get_trial_sample(self, case_id: str, sample_key: str):
        await self.flush()
        async with get_db_connection() as db:
            async with db.execute("""
                SELECT id, timestamp, presence, latency_ms, calibration_state
                FROM telemetry WHERE case_id = ? AND sample_key = ?
            """, (case_id, sample_key)) as cursor:
                return await cursor.fetchone()

    async def get_history(self, case_id: str, limit: int = 50) -> list[TelemetryHistoryRecord]:
        await self.flush()
        async with get_db_connection() as db:
            cursor = await db.execute(
                """
                SELECT id, case_id, timestamp, presence, raw_value, latency_ms, score
                FROM telemetry WHERE case_id = ? ORDER BY id DESC LIMIT ?
                """,
                (case_id, limit),
            )
            return [TelemetryHistoryRecord(**dict(row)) for row in await cursor.fetchall()]


telemetry_repo = TelemetryRepository()
