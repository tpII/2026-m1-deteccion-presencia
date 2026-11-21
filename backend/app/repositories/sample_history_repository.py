from app.constants import CaseId
from app.database import get_db_connection
from app.schemas.telemetry import StoredSample, StoredSamplePage


async def get_sample_history(
    start: str, end: str, case_id: CaseId | None, before: int | None, limit: int,
) -> StoredSamplePage:
    filters = ["timestamp >= ?", "timestamp < ?"]
    params: list[str | int] = [start, end]
    if case_id is None:
        filters.append("case_id IN (?, ?)")
        params.extend(CaseId)
    else:
        filters.append("case_id = ?")
        params.append(case_id)
    if before is not None:
        filters.append("(timestamp, id) < (SELECT timestamp, id FROM telemetry WHERE id = ?)")
        params.append(before)

    async with get_db_connection() as db:
        cursor = await db.execute(
            f"""
            SELECT id, case_id, timestamp, presence, raw_value, latency_ms, score,
                   calibration_state, calibration_id
            FROM telemetry
            WHERE {" AND ".join(filters)}
            ORDER BY timestamp DESC, id DESC
            LIMIT ?
            """,
            (*params, limit + 1),
        )
        rows = await cursor.fetchall()

    return StoredSamplePage(
        samples=[StoredSample(**dict(row)) for row in rows[:limit]],
        next_cursor=rows[limit - 1]["id"] if len(rows) > limit else None,
    )
