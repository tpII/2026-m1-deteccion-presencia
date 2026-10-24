from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.logging_config import logger
from app.telemetry_state import telemetry_state
from app.websocket import ws_manager

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        await ws_manager.send_json(websocket, telemetry_state.get_message("initial_state"))
        while True:
            if await websocket.receive_text() == "ping":
                await ws_manager.send_text(websocket, "pong")
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("Error en la conexión WebSocket")
    finally:
        await ws_manager.disconnect(websocket)
