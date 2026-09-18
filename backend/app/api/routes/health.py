"""Endpoint de verificación de salud del sistema."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from app.core.config import settings
from app.services.websocket_manager import WebSocketManager
from app.api.dependencies import get_websocket_manager

router = APIRouter(prefix="/health", tags=["Salud del Sistema"])


@router.get("")
async def get_health_status(ws_mgr: WebSocketManager = Depends(get_websocket_manager)):
    """Retorna el estado operativo general, modo de datos y clientes conectados."""
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "data_source": settings.DATA_SOURCE,
        "active_ws_clients": ws_mgr.client_count,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
