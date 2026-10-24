import logging
import sys
from app.config import settings


def setup_logging():
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )
    if not settings.APP_DEBUG:
        logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


logger = logging.getLogger("presence_detection")
