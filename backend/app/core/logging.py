"""Configuración de logging estructurado para el backend."""

import logging
import sys
from app.core.config import settings


def setup_logging():
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )
    # Silenciar logs excesivos de uvicorn access si no es debug
    if not settings.DEBUG:
        logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


logger = logging.getLogger("presence_detection")
