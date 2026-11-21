from datetime import datetime, timezone

from app.constants import CaseId
from app.database import get_db_connection


async def record_start(environment: str) -> int:
    started_at = datetime.now(timezone.utc).isoformat(timespec="microseconds")
    async with get_db_connection() as db:
        cursor = await db.execute(
            "INSERT INTO csi_calibration_events (case_id, started_at, environment, outcome) VALUES (?, ?, ?, 'en_curso')",
            (CaseId.CSI_ROUTER, started_at, environment),
        )
        await db.commit()
        return cursor.lastrowid


async def close_interrupted_calibrations() -> None:
    now = datetime.now(timezone.utc).isoformat(timespec="microseconds")
    async with get_db_connection() as db:
        await db.execute("""
            UPDATE csi_calibration_events SET outcome = 'interrumpida', finished_at = ?
            WHERE case_id = ? AND outcome = 'en_curso'
        """, (now, CaseId.CSI_ROUTER))
        await db.commit()
