"""Gestor centralizado de conexiones WebSocket."""

import asyncio
from datetime import datetime
from typing import Set, Dict, Any
from fastapi import WebSocket, WebSocketDisconnect
from app.core.logging import logger


class WebSocketManager:
    """
    Administra los clientes WebSocket conectados a /ws/telemetry.
    Implementa emisión segura de mensajes y control de desconexiones.
    """

    def __init__(self):
        self._active_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self._active_connections.add(websocket)
        logger.info(f"Cliente WebSocket conectado. Conexiones activas: {len(self._active_connections)}")

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            if websocket in self._active_connections:
                self._active_connections.remove(websocket)
        logger.info(f"Cliente WebSocket desconectado. Conexiones activas: {len(self._active_connections)}")

    async def broadcast_json(self, data: Dict[str, Any]):
        """Envía un diccionario JSON a todos los clientes activos concurrentemente."""
        if not self._active_connections:
            return

        async with self._lock:
            connections = list(self._active_connections)

        disconnected = []
        for ws in connections:
            try:
                await ws.send_json(data)
            except (WebSocketDisconnect, RuntimeError, Exception):
                disconnected.append(ws)

        if disconnected:
            async with self._lock:
                for ws in disconnected:
                    if ws in self._active_connections:
                        self._active_connections.remove(ws)

    @property
    def client_count(self) -> int:
        return len(self._active_connections)


ws_manager = WebSocketManager()
