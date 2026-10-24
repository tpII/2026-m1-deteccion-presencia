import asyncio

from fastapi import WebSocket

from app.logging_config import logger


class WebSocketManager:
    def __init__(self):
        self._connections: dict[WebSocket, asyncio.Lock] = {}

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[websocket] = asyncio.Lock()

    async def disconnect(self, websocket: WebSocket) -> None:
        self._connections.pop(websocket, None)

    async def send_json(self, websocket: WebSocket, data: dict) -> None:
        async with self._connections[websocket]:
            await websocket.send_json(data)

    async def send_text(self, websocket: WebSocket, text: str) -> None:
        async with self._connections[websocket]:
            await websocket.send_text(text)

    async def _broadcast_to(self, websocket: WebSocket, data: dict) -> None:
        try:
            await asyncio.wait_for(self.send_json(websocket, data), timeout=2)
        except Exception:
            logger.debug("Cliente WebSocket desconectado durante la emisión")
            await self.disconnect(websocket)
            try:
                await asyncio.wait_for(websocket.close(code=1011), timeout=1)
            except Exception:
                logger.debug("El transporte WebSocket ya estaba cerrado o no respondió")

    async def broadcast_json(self, data: dict) -> None:
        await asyncio.gather(*(
            self._broadcast_to(websocket, data) for websocket in list(self._connections)
        ))

    @property
    def client_count(self) -> int:
        return len(self._connections)


ws_manager = WebSocketManager()
