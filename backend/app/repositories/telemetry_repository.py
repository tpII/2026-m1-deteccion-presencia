import asyncio
from datetime import datetime, timezone

from app.database import get_db_connection
from app.schemas.telemetry import TelemetryHistoryRecord


class TelemetryRepository:
    def __init__(self):
        self._pending: list[tuple] = []
        self._flush_lock = asyncio.Lock()

    def enqueue(
        self,
        case_id: str,
        presence: bool,
        raw_value: float,
        latency_ms: float,
        score: float | None = None,
    ) -> None:
        self._pending.append((
            case_id,
            datetime.now(timezone.utc).isoformat(),
            int(presence),
            raw_value,
            latency_ms,
            score,
        ))

    async def flush(self) -> None:
        async with self._flush_lock:
            batch = self._pending[:]
            if not batch:
                return
            async with get_db_connection() as db:
                await db.executemany(
                    """
                    INSERT INTO telemetry (case_id, timestamp, presence, raw_value, latency_ms, score)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    batch,
                )
                await db.commit()
                del self._pending[:len(batch)]

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
