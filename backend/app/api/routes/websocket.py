"""Endpoint WebSocket para suscripción de telemetría y señales en vivo."""

from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from app.services.websocket_manager import WebSocketManager
from app.api.dependencies import get_websocket_manager
from app.repositories.telemetry_repository import telemetry_repo
from app.core.constants import CaseId
from app.core.logging import logger

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(
    websocket: WebSocket,
    ws_mgr: WebSocketManager = Depends(get_websocket_manager),
):
    """
    Canal de comunicación bidireccional en tiempo real.
    Envía inmediatamente el estado inicial al cliente y luego emite lotes periódicos a ~8 Hz.
    """
    await ws_mgr.connect(websocket)
    try:
        # 1. Enviar estado inicial inmediato al cliente conectado
        initial_payload = {
            "type": "initial_state",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": {
                "statuses": [s.model_dump() for s in telemetry_repo.get_all_statuses()],
                "cases": {
                    CaseId.PIR.value: telemetry_repo.get_payload(CaseId.PIR.value).model_dump(),
                    CaseId.CSI_ROUTER.value: telemetry_repo.get_payload(CaseId.CSI_ROUTER.value).model_dump(),
                    CaseId.CSI_DEDICATED.value: telemetry_repo.get_payload(CaseId.CSI_DEDICATED.value).model_dump(),
                },
            },
        }
        await websocket.send_json(initial_payload)

        # 2. Mantener bucle de escucha para ping/pong o comandos del cliente
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")

    except WebSocketDisconnect:
        await ws_mgr.disconnect(websocket)
    except Exception as e:
        logger.error(f"Error inesperado en WebSocket: {e}")
        await ws_mgr.disconnect(websocket)
