"""Contrato real con Mosquitto: QoS, retain, última voluntad y reconexión."""

import asyncio
import os
from pathlib import Path
import runpy
import shutil
import socket
import subprocess
import sys

import numpy as np
import paho.mqtt.client as mqtt
from paho.mqtt.subscribe import simple
import pytest

from app.config import settings
from app.mqtt import MQTTDataSource, STATUS_TOPICS
from app.telemetry_state import TelemetryState

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_MQTT_INTEGRATION") != "1" or not shutil.which("mosquitto"),
    reason="Requiere RUN_MQTT_INTEGRATION=1 y Mosquitto",
)


async def wait_for(check):
    async with asyncio.timeout(8):
        while not check():
            await asyncio.sleep(0.02)


async def test_retained_status_lwt_and_backend_reconnection(tmp_path, monkeypatch):
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    config = tmp_path / "mosquitto.conf"
    config.write_text(f"listener {port} 127.0.0.1\nallow_anonymous true\npersistence false\n")
    monkeypatch.setattr(settings, "MQTT_HOST", "127.0.0.1")
    monkeypatch.setattr(settings, "MQTT_PORT", port)
    monkeypatch.setattr(settings, "MQTT_CLIENT_ID", f"status-backend-{port}")
    state = TelemetryState()

    def connected(case):
        return next(status.is_connected for status in state.get_all_statuses() if status.case_id == case)

    def make_source():
        source = MQTTDataSource()
        source.set_status_handler(state.set_device_connection)
        source.set_connection_handler(state.set_broker_connection)
        return source

    source = make_source()
    nodes = []
    with (tmp_path / "broker.log").open("w") as log:
        broker = subprocess.Popen(["mosquitto", "-c", str(config)], stdout=log, stderr=log)
        try:
            await source.start()
            await wait_for(lambda: source.is_connected)
            for topic, case in STATUS_TOPICS.items():
                node = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"node-{case}-{port}")
                node.will_set(topic, "offline", qos=1, retain=True)
                await asyncio.to_thread(node.connect, "127.0.0.1", port, 15)
                node.loop_start()
                nodes.append(node)
                published = node.publish(topic, "online", qos=1, retain=True)
                await asyncio.to_thread(published.wait_for_publish, 3)
                await wait_for(lambda: connected(case))

            # Un suscriptor tardío recibe ambos estados con QoS 1 y RETAIN activo.
            messages = await asyncio.wait_for(asyncio.to_thread(
                simple, list(STATUS_TOPICS), qos=1, msg_count=2, hostname="127.0.0.1", port=port,
            ), 5)
            assert {message.topic for message in messages} == set(STATUS_TOPICS)
            assert all(message.payload == b"online" and message.qos == 1 and message.retain for message in messages)
            assert all(status.total_samples == 0 for status in state.get_all_statuses())

            # Reiniciar la ingesta recupera los estados sin publicar muestras nuevas.
            await source.stop()
            assert not any(connected(case) for case in STATUS_TOPICS.values())
            source = make_source()
            await source.start()
            await wait_for(lambda: all(connected(case) for case in STATUS_TOPICS.values()))

            for node, (topic, case) in zip(nodes, STATUS_TOPICS.items()):
                # Cortar TCP sin DISCONNECT hace que el broker emita la última voluntad.
                node.socket().shutdown(socket.SHUT_RDWR)
                await asyncio.to_thread(node.loop_stop)
                await wait_for(lambda: not connected(case))
                retained = await asyncio.wait_for(asyncio.to_thread(
                    simple, topic, qos=1, hostname="127.0.0.1", port=port,
                ), 5)
                assert retained.payload == b"offline" and retained.qos == 1 and retained.retain

                await asyncio.to_thread(node.reconnect)
                node.loop_start()
                published = node.publish(topic, "online", qos=1, retain=True)
                await asyncio.to_thread(published.wait_for_publish, 3)
                await wait_for(lambda: connected(case))

            # El reproductor también reemplaza estados retenidos y cierra como offline.
            for node in nodes:
                await asyncio.to_thread(node.disconnect)
                await asyncio.to_thread(node.loop_stop)
            analysis = Path(__file__).resolve().parents[2] / "prueba_CSI/analisis"
            monkeypatch.syspath_prepend(str(analysis))
            replay = runpy.run_path(str(analysis / "reproducir_log_mqtt.py"))["main"]
            monkeypatch.setitem(replay.__globals__, "parse_log", lambda path: [{"packets": [1, 2]}])
            monkeypatch.setitem(replay.__globals__, "amplitudes", lambda packets: (
                np.array([0.0, 0.1]), np.array([[20.0, 21.0], [21.0, 22.0]]), None,
            ))
            monkeypatch.setattr(sys, "argv", ["replay", "test.log", "--host", "127.0.0.1", "--port", str(port)])
            replay_states = []

            def record_status(case, online):
                replay_states.append((case, online))
                state.set_device_connection(case, online)

            source.set_status_handler(record_status)
            await asyncio.to_thread(replay)
            await wait_for(lambda: not connected("csi_router"))
            assert replay_states == [("csi_router", True), ("csi_router", False)]
            retained = await asyncio.wait_for(asyncio.to_thread(
                simple, "presence/csi/router/status", qos=1, hostname="127.0.0.1", port=port,
            ), 5)
            assert retained.payload == b"offline" and retained.qos == 1 and retained.retain

        finally:
            for node in nodes:
                await asyncio.to_thread(node.disconnect)
                await asyncio.to_thread(node.loop_stop)
            await source.stop()
            broker.terminate()
            await asyncio.to_thread(broker.wait, 5)
