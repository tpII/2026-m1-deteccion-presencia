"""Conexión y gestión de esquema SQLite asíncrono."""

import os
import aiosqlite
from app.core.config import settings

from contextlib import asynccontextmanager

@asynccontextmanager
async def get_db_connection():
    """Retorna un context manager asíncrono para conexión SQLite con Row factory."""
    db_path = settings.DATABASE_URL.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")
    async with aiosqlite.connect(db_path) as conn:
        conn.row_factory = aiosqlite.Row
        yield conn


async def init_db():
    """Inicializa las tablas sin insertar mediciones ni ensayos."""
    db_path = settings.DATABASE_URL.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

    async with aiosqlite.connect(db_path) as db:
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
            CREATE TABLE IF NOT EXISTS experiments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                case_id TEXT NOT NULL,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                environment TEXT,
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

        # Prueba USB real: guarda lecturas por separado de MQTT.
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
