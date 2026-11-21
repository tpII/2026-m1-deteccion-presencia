from datetime import datetime, timedelta, timezone
import json
from math import ceil

import numpy as np

from app.constants import CaseId
from app.database import get_db_connection
from app.schemas.csi_capture import (
    CsiCapture, CsiCaptureComparison, CsiCapturePreview, CsiHeatmap, CsiHeatmapColumn, StartCsiCapture,
)
from app.signal_processing.indicators import profile

CAPTURE_LIMIT_SECONDS = 300
MAX_HEATMAP_COLUMNS = 240
# Orden de HT-LTF del firmware del router, k = -28..28 sin 0 ni 1.
SUBCARRIER_COUNT = 55


def utc_timestamp(time: datetime) -> str:
    return time.isoformat(timespec="microseconds")


async def start_capture(request: StartCsiCapture) -> CsiCapture | None:
    async with get_db_connection() as db:
        await db.execute("BEGIN IMMEDIATE")
        now = datetime.now(timezone.utc)
        starts_at = utc_timestamp(now)
        async with db.execute("SELECT 1 FROM csi_captures WHERE ends_at > ? LIMIT 1", (starts_at,)) as cursor:
            if await cursor.fetchone():
                return None
        ends_at = utc_timestamp(now + timedelta(seconds=CAPTURE_LIMIT_SECONDS))
        cursor = await db.execute(
            "INSERT INTO csi_captures (environment, activity, starts_at, ends_at) VALUES (?, ?, ?, ?)",
            (request.environment, request.activity, starts_at, ends_at),
        )
        await db.commit()
        return CsiCapture(id=cursor.lastrowid, starts_at=starts_at, ends_at=ends_at, **request.model_dump())


async def finish_capture(capture_id: int) -> CsiCapture | None:
    async with get_db_connection() as db:
        await db.execute("BEGIN IMMEDIATE")
        now = utc_timestamp(datetime.now(timezone.utc))
        await db.execute("UPDATE csi_captures SET ends_at = ? WHERE id = ? AND ends_at > ?", (now, capture_id, now))
        async with db.execute("SELECT * FROM csi_captures WHERE id = ?", (capture_id,)) as cursor:
            row = await cursor.fetchone()
        await db.commit()
        return CsiCapture(**dict(row)) if row else None


async def get_comparison(environment: str | None, as_of: str) -> CsiCaptureComparison:
    async with get_db_connection() as db:
        async with db.execute(
            "SELECT * FROM csi_captures WHERE starts_at <= ? AND ends_at > ? LIMIT 1",
            (as_of, as_of),
        ) as cursor:
            active = await cursor.fetchone()
        heatmaps = []
        if environment:
            async with db.execute("""
                SELECT * FROM csi_captures
                WHERE id IN (
                    SELECT MAX(id) FROM csi_captures WHERE environment = ? AND ends_at <= ? GROUP BY activity
                )
            """, (environment, as_of)) as cursor:
                captures = [CsiCapture(**dict(row)) for row in await cursor.fetchall()]
            for capture in captures:
                heatmaps.append(await get_heatmap(db, capture))
    return CsiCaptureComparison(as_of=as_of, active_capture=CsiCapture(**dict(active)) if active else None, heatmaps=heatmaps)


async def get_preview(capture_id: int, as_of: str) -> CsiCapturePreview | None:
    async with get_db_connection() as db:
        async with db.execute("SELECT * FROM csi_captures WHERE id = ?", (capture_id,)) as cursor:
            row = await cursor.fetchone()
        if row is None:
            return None
        capture = CsiCapture(**dict(row))
        heatmap = await get_heatmap(db, capture, as_of)
        return CsiCapturePreview(active=capture.ends_at > as_of, heatmap=heatmap)


async def get_heatmap(db, capture: CsiCapture, as_of: str | None = None) -> CsiHeatmap:
    end = min(as_of, capture.ends_at) if as_of else capture.ends_at
    duration = (datetime.fromisoformat(end) - datetime.fromisoformat(capture.starts_at)).total_seconds()
    step = max(0.25, ceil(duration * 4 / MAX_HEATMAP_COLUMNS) / 4)
    count = max(1, ceil(duration / step))
    # Un paquete representativo por intervalo. Los huecos se conservan y SQLite retiene todos los paquetes.
    async with db.execute("""
        WITH bins AS (
            SELECT MIN(id) AS sample_id,
                   MIN(?, MAX(0, CAST((julianday(timestamp) - julianday(?)) * 86400 / ? AS INTEGER))) AS bin
            FROM telemetry
            WHERE case_id = ? AND timestamp >= ? AND timestamp < ?
              AND amplitudes_json IS NOT NULL AND json_array_length(amplitudes_json) = ?
            GROUP BY bin
        )
        SELECT bins.bin, telemetry.amplitudes_json FROM bins JOIN telemetry ON telemetry.id = bins.sample_id
        ORDER BY bins.bin
    """, (count - 1, capture.starts_at, step, CaseId.CSI_ROUTER,
          capture.starts_at, end, SUBCARRIER_COUNT)) as cursor:
        columns = [
            CsiHeatmapColumn(index=row["bin"], relative_amplitudes=profile(np.array(json.loads(row["amplitudes_json"]))).tolist())
            for row in await cursor.fetchall()
        ]
    return CsiHeatmap(capture=capture, step_seconds=step, column_count=count, columns=columns)
