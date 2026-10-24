from contextlib import asynccontextmanager

import aiosqlite

from app.config import settings


@asynccontextmanager
async def get_db_connection():
    async with aiosqlite.connect(settings.database_path) as conn:
        conn.row_factory = aiosqlite.Row
        yield conn


async def init_db() -> None:
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)

    async with get_db_connection() as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS trials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                ground_truth INTEGER NOT NULL,
                detected_presence INTEGER NOT NULL,
                is_correct INTEGER NOT NULL,
                latency_ms REAL NOT NULL,
                score REAL,
                notes TEXT
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS telemetry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                presence INTEGER NOT NULL,
                raw_value REAL NOT NULL,
                latency_ms REAL NOT NULL,
                score REAL
            )
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_telemetry_case_time
            ON telemetry(case_id, id DESC)
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS pir_usb_readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                received_at TEXT NOT NULL,
                motion INTEGER NOT NULL CHECK (motion IN (0, 1)),
                UNIQUE (received_at, motion)
            )
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_pir_usb_received_at
            ON pir_usb_readings (received_at DESC, id DESC)
        """)

        await db.commit()
