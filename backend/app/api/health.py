from datetime import datetime, timezone
from fastapi import APIRouter
from app.config import settings
from app.websocket import ws_manager
from app.telemetry import telemetry_service

router = APIRouter(prefix="/health", tags=["Salud del Sistema"])


@router.get("")
async def get_health_status():
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "data_source": settings.DATA_SOURCE,
        "mqtt_connected": (
            telemetry_service.data_source.is_connected
            if telemetry_service.data_source else None
        ),
        "active_ws_clients": ws_manager.client_count,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
