"""Aislar las comprobaciones de software de las bases con mediciones reales."""

import pytest
from app.core.config import settings


@pytest.fixture(autouse=True)
def isolated_database(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "DATABASE_URL", f"sqlite+aiosqlite:///{tmp_path / 'test.db'}")
