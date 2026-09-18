"""Inyección de dependencias para rutas FastAPI."""

from app.services.telemetry_service import telemetry_service
from app.services.metrics_service import metrics_service
from app.services.websocket_manager import ws_manager


def get_telemetry_service():
    return telemetry_service


def get_metrics_service():
    return metrics_service


def get_websocket_manager():
    return ws_manager
