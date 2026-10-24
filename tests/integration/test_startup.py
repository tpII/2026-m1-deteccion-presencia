"""Verifica los comandos del README y el apagado de sus procesos locales."""

import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import time
import urllib.request
import pytest
from paho.mqtt.publish import multiple
from websockets.sync.client import connect

ROOT = Path(__file__).resolve().parents[2]
pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_MQTT_INTEGRATION") != "1" or not shutil.which("mosquitto"),
    reason="Requiere RUN_MQTT_INTEGRATION=1 y dependencias locales instaladas",
)


def open_port(port):
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.2):
            return True
    except OSError:
        return False


def test_occupied_port_fails_without_stopping_another_server():
    if open_port(8000):
        pytest.skip("Hay un servidor del usuario en el puerto de la prueba")
    with socket.socket() as server:
        server.bind(("127.0.0.1", 8000))
        server.listen()
        result = subprocess.run(["bash", "start.sh"], cwd=ROOT, capture_output=True, text=True, timeout=5)
        assert result.returncode == 1
        assert "puerto 8000 esta ocupado" in result.stderr
        assert "unbound variable" not in result.stderr
        assert open_port(8000)


@pytest.mark.parametrize("args", [[], ["mqtt"]])
def test_startup_mode_and_cleanup(args, tmp_path):
    ports = [8000, 5173, 1883]
    if any(open_port(port) for port in ports):
        pytest.skip("Hay servicios del usuario activos en los puertos de la prueba")
    env = dict(os.environ, APP_DEBUG="false", MQTT_HOST="127.0.0.1", MQTT_PORT="1883",
               DATABASE_URL=f"sqlite+aiosqlite:///{tmp_path / 'telemetry.db'}")
    with (tmp_path / "startup.log").open("w") as output:
        process = subprocess.Popen(["bash", "start.sh", *args], cwd=ROOT, env=env, stdout=output, stderr=subprocess.STDOUT)
        try:
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                assert process.poll() is None, (tmp_path / "startup.log").read_text()
                try:
                    with urllib.request.urlopen("http://127.0.0.1:8000/api/v1/health", timeout=1) as response:
                        health = json.load(response)
                    with urllib.request.urlopen("http://127.0.0.1:5173", timeout=1) as response:
                        assert response.status == 200
                    with urllib.request.urlopen("http://127.0.0.1:8000/api/v1/telemetry/status", timeout=1) as response:
                        statuses = json.load(response)
                    if health["mqtt_connected"]:
                        break
                except OSError:
                    pass
                time.sleep(0.2)
            else:
                pytest.fail((tmp_path / "startup.log").read_text())
            assert health["data_source"] == "mqtt"
            assert health["mqtt_connected"] is True
            assert all(row["total_samples"] == 0 and not row["is_connected"] for row in statuses)
            with urllib.request.urlopen("http://127.0.0.1:8000/api/v1/metrics/pir", timeout=1) as response:
                assert json.load(response)["total_tests"] == 0
            samples = [
                ("presence/pir/telemetry", {"case_id": "pir", "presence": True, "raw_value": 1}),
                ("presence/csi/router/raw", {"case_id": "csi_router", "amplitudes": [23, 99]}),
                ("presence/csi/dedicated/raw", {"case_id": "csi_dedicated", "amplitudes": [21, 99]}),
            ]
            with connect("ws://127.0.0.1:8000/ws/telemetry") as websocket:
                assert json.loads(websocket.recv(timeout=2))["type"] == "initial_state"
                multiple([{"topic": topic, "payload": json.dumps(sample), "qos": 1} for topic, sample in samples], hostname="127.0.0.1")
                deadline = time.monotonic() + 5
                while time.monotonic() < deadline:
                    message = json.loads(websocket.recv(timeout=2))
                    if all(status["total_samples"] == 1 for status in message["data"]["statuses"]):
                        break
                else:
                    pytest.fail("Las muestras MQTT no llegaron al WebSocket")
                assert message["data"]["cases"]["pir"]["presence"] is True
                assert message["data"]["cases"]["csi_router"]["raw_points"][-1]["value"] == 23
            for _, sample in samples:
                with urllib.request.urlopen(f"http://127.0.0.1:8000/api/v1/telemetry/{sample['case_id']}/history", timeout=2) as response:
                    assert len(json.load(response)) == 1
        finally:
            process.send_signal(signal.SIGTERM)
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        deadline = time.monotonic() + 5
        while any(open_port(port) for port in ports) and time.monotonic() < deadline:
            time.sleep(0.1)
        assert not any(open_port(port) for port in ports), "Quedaron procesos escuchando despues de detener start.sh"
