from datetime import timezone
from app.database import get_db_connection
from app.schemas.pir_usb import PirUsbReading, PirUsbRecord


async def save_readings(readings: list[PirUsbReading]) -> int:
    rows = [
        (reading.received_at.astimezone(timezone.utc).isoformat(), int(reading.motion))
        for reading in readings
    ]
    async with get_db_connection() as db:
        await db.executemany(
            "INSERT OR IGNORE INTO pir_usb_readings (received_at, motion) VALUES (?, ?)",
            rows,
        )
        await db.commit()
        return db.total_changes


async def get_history(limit: int) -> list[PirUsbRecord]:
    async with get_db_connection() as db:
        cursor = await db.execute(
            "SELECT id, received_at, motion FROM pir_usb_readings ORDER BY received_at DESC, id DESC LIMIT ?",
            (limit,),
        )
        return [
            PirUsbRecord(id=row["id"], received_at=row["received_at"], motion=bool(row["motion"]))
            for row in await cursor.fetchall()
        ]
