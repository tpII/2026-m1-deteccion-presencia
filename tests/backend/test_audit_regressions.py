import asyncio
from unittest.mock import AsyncMock

from app.config import Settings
from app.websocket import WebSocketManager


def test_debug_from_other_tools_does_not_break_startup(monkeypatch):
    monkeypatch.setenv("DEBUG", "release")
    monkeypatch.setenv("APP_DEBUG", "false")
    assert Settings(_env_file=None).APP_DEBUG is False
    monkeypatch.setenv("APP_DEBUG", "true")
    assert Settings(_env_file=None).APP_DEBUG is True


async def test_failed_broadcast_closes_socket_so_the_browser_can_reconnect():
    manager = WebSocketManager()
    websocket = AsyncMock()
    websocket.send_json.side_effect = RuntimeError("Conexión bloqueada")
    await manager.connect(websocket)
    await manager.broadcast_json({"type": "telemetry_batch"})
    assert manager.client_count == 0
    websocket.close.assert_awaited_once()


async def test_slow_client_does_not_delay_other_clients():
    manager = WebSocketManager()
    slow, fast = AsyncMock(), AsyncMock()
    release_slow = asyncio.Event()
    delivered = asyncio.Event()

    async def slow_send(_):
        await release_slow.wait()

    async def fast_send(_):
        delivered.set()

    slow.send_json.side_effect = slow_send
    fast.send_json.side_effect = fast_send
    await manager.connect(slow)
    await manager.connect(fast)
    broadcast = asyncio.create_task(manager.broadcast_json({"value": 1}))
    try:
        await asyncio.wait_for(delivered.wait(), timeout=0.5)
    finally:
        release_slow.set()
        await broadcast
    assert manager.client_count == 2
