"""Evita que los módulos propios vuelvan a alcanzar las 200 líneas."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIRS = (
    'backend/app', 'frontend/src', 'firmware/pir/src', 'firmware/pir/include',
    'firmware/csi_router/src', 'firmware/csi_router/include',
    'prueba_CSI/src', 'prueba_CSI/include', 'prueba_CSI/analisis',
    'scripts', 'tests',
)
SOURCE_EXTENSIONS = {'.py', '.ts', '.tsx', '.css', '.cpp', '.h', '.sh', '.ps1', '.bat', '.mjs'}


def test_project_modules_have_fewer_than_200_lines():
    paths = [ROOT / name for name in ('start.sh', 'start.ps1', 'start.bat')]
    paths.extend(
        path for folder in SOURCE_DIRS for path in (ROOT / folder).rglob('*')
        if path.is_file() and path.suffix in SOURCE_EXTENSIONS
    )
    oversized = []
    for path in paths:
        count = len(path.read_text().splitlines())
        if count >= 200:
            oversized.append(f'{path.relative_to(ROOT)}: {count} líneas')
    assert not oversized, '\n'.join(oversized)
