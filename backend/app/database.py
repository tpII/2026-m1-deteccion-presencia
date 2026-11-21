from contextlib import asynccontextmanager

import aiosqlite

from app.config import settings


@asynccontextmanager
async def get_db_connection():
    async with aiosqlite.connect(settings.database_path) as conn:
        conn.row_factory = aiosqlite.Row
        yield conn


async def add_missing_columns(db, table: str, columns: dict[str, str]) -> None:
    async with db.execute(f"PRAGMA table_info({table})") as cursor:
        existing = {row["name"] for row in await cursor.fetchall()}
    for name, column_type in columns.items():
        if name not in existing:
            await db.execute(f"ALTER TABLE {table} ADD COLUMN {name} {column_type}")


async def init_db() -> None:
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)

    async with get_db_connection() as db:
        await db.execute("BEGIN IMMEDIATE")
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
                notes TEXT,
                environment TEXT,
                scenario TEXT
            )
        """)
        await add_missing_columns(db, "trials", {
            "environment": "TEXT", "scenario": "TEXT",
            "observed_at": "TEXT", "sample_received_at": "TEXT",
            "telemetry_id": "INTEGER REFERENCES telemetry(id)",
        })

        await db.execute("""
            CREATE TABLE IF NOT EXISTS telemetry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                presence INTEGER NOT NULL,
                raw_value REAL NOT NULL,
                latency_ms REAL NOT NULL,
                score REAL,
                source TEXT,
                sample_timestamp TEXT,
                ground_truth INTEGER,
                amplitudes_json TEXT,
                features_json TEXT,
                calibration_state TEXT
            )
        """)
        await add_missing_columns(db, "telemetry", {
            "source": "TEXT", "sample_timestamp": "TEXT", "ground_truth": "INTEGER",
            "amplitudes_json": "TEXT", "features_json": "TEXT", "calibration_state": "TEXT",
            "sample_key": "TEXT",
            "run_id": "TEXT",
            "calibration_id": "INTEGER REFERENCES csi_calibration_events(id)",
        })

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_telemetry_case_time
            ON telemetry(case_id, id DESC)
        """)
        await db.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_telemetry_sample_key
            ON telemetry(sample_key) WHERE sample_key IS NOT NULL
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS csi_calibration_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id TEXT NOT NULL,
                started_at TEXT NOT NULL,
                environment TEXT
            )
        """)
        await add_missing_columns(db, "csi_calibration_events", {
            "finished_at": "TEXT", "outcome": "TEXT", "profile_json": "TEXT",
            "movement_threshold": "REAL", "shape_threshold": "REAL", "sample_count": "INTEGER",
        })
        await db.execute("""
            CREATE TABLE IF NOT EXISTS observations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id TEXT NOT NULL,
                environment TEXT NOT NULL,
                scenario TEXT,
                observed_at TEXT NOT NULL,
                received_at TEXT NOT NULL,
                run_id TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_observations_timeline
            ON observations(case_id, run_id, observed_at DESC, id DESC)
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_telemetry_calibration
            ON telemetry(calibration_id, case_id) WHERE calibration_id IS NOT NULL
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_telemetry_run_time
            ON telemetry(case_id, timestamp DESC) WHERE run_id IS NOT NULL
        """)
        await db.execute("""
            CREATE VIEW IF NOT EXISTS evaluated_samples AS
            SELECT sample.id, sample.case_id, sample.timestamp, sample.calibration_id,
                   sample.presence AS detected_presence, mark.id AS observation_id,
                   mark.environment, mark.observed_at, mark.scenario,
                   CASE
                       WHEN sample.presence = 1 AND mark.scenario = 'absent' THEN 'false_positive'
                       WHEN sample.presence = 0 AND mark.scenario != 'absent' THEN 'false_negative'
                       ELSE 'correct'
                   END AS result
            FROM telemetry AS sample
            LEFT JOIN csi_calibration_events AS calibration ON calibration.id = sample.calibration_id
            JOIN observations AS mark ON mark.id = (
                SELECT id FROM observations
                WHERE case_id = sample.case_id AND run_id = sample.run_id AND observed_at <= sample.timestamp
                ORDER BY observed_at DESC, id DESC LIMIT 1
            )
            WHERE sample.run_id IS NOT NULL AND mark.scenario IS NOT NULL
              AND (sample.case_id = 'pir' OR sample.calibration_state = 'calibrado')
              AND (sample.calibration_id IS NULL OR mark.observed_at >= calibration.finished_at)
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_telemetry_case_timestamp
            ON telemetry(case_id, timestamp) WHERE amplitudes_json IS NOT NULL
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS csi_captures (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                environment TEXT NOT NULL,
                activity TEXT NOT NULL CHECK (activity IN ('empty', 'walking', 'seated')),
                starts_at TEXT NOT NULL,
                ends_at TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_csi_captures_environment
            ON csi_captures(environment, activity, id DESC)
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
