#!/usr/bin/env python3
"""
Script para resetear la base de datos SQLite y restaurar los ensayos académicos iniciales.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.core.config import settings
from app.database.connection import init_db


async def main():
    db_path = settings.DATABASE_URL.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")
    print(f"Borrando base de datos anterior en: {db_path}")
    if os.path.exists(db_path):
        os.remove(db_path)
        print("Archivo de base de datos eliminado.")
    else:
        print("No existía base de datos previa.")

    print("Inicializando nuevo esquema y ensayos de referencia...")
    await init_db()
    print("Base de datos reseteada exitosamente.")


if __name__ == "__main__":
    asyncio.run(main())
