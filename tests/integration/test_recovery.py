import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time

import httpx
from paho.mqtt.publish import multiple, single
import pytest
from websockets.sync.client import connect

ROOT = Path(__file__).resolve().parents[2]
pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_MQTT_INTEGRATION") != "1" or not shutil.which("mosquitto"),
    reason="Requiere RUN_MQTT_INTEGRATION=1 y Mosquitto",
)


def free_port():
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


def stop(process):
    if process is not None and process.poll() is None:
        process.send_signal(signal.SIGTERM)
        process.wait(timeout=15)


def wait_for(check, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            if check():
                return
        except (httpx.HTTPError, OSError):
            pass
        time.sleep(0.1)
    pytest.fail("El servicio no alcanzó el estado esperado")


def test_burst_broker_reconnection_and_database_survive_restart(tmp_path):
    broker_port, api_port = free_port(), free_port()
    broker_config = tmp_path / "mosquitto.conf"
    broker_config.write_text(f"listener {broker_port} 127.0.0.1\nallow_anonymous true\n")
    environment = dict(
        os.environ,
        APP_DEBUG="false",
        MQTT_HOST="127.0.0.1",
        MQTT_PORT=str(broker_port),
        MQTT_CLIENT_ID=f"audit-{api_port}",
        DATABASE_URL=f"sqlite+aiosqlite:///{tmp_path / 'recovery.db'}",
    )
    broker = backend = None
    with (tmp_path / "services.log").open("w") as log, httpx.Client(
        base_url=f"http://127.0.0.1:{api_port}/api/v1", timeout=3,
    ) as api:
        def start_broker():
            return subprocess.Popen(["mosquitto", "-c", str(broker_config)], stdout=log, stderr=log)

        def start_backend():
            return subprocess.Popen(
                [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(api_port)],
                cwd=ROOT / "backend", env=environment, stdout=log, stderr=log,
            )

        try:
            broker = start_broker()
            backend = start_backend()
            wait_for(lambda: api.get("/health").json()["mqtt_connected"])
            endpoint = f"ws://127.0.0.1:{api_port}/ws/telemetry"
            with connect(endpoint) as first, connect(endpoint) as second:
                assert json.loads(first.recv(timeout=3))["type"] == "initial_state"
                assert json.loads(second.recv(timeout=3))["type"] == "initial_state"
                samples = [("presence/pir/telemetry", {
                    "case_id": "pir", "presence": bool(index % 2), "raw_value": index % 2,
                }) for index in range(120)]
                for case, topic in [("csi_router", "presence/csi/router/raw"), ("csi_dedicated", "presence/csi/dedicated/raw")]:
                    samples.extend((topic, {"case_id": case, "amplitudes": [20 + index % 5, 99]}) for index in range(30))
                multiple([
                    {"topic": topic, "payload": json.dumps(sample), "qos": 1} for topic, sample in samples
                ], hostname="127.0.0.1", port=broker_port)
                for client in (first, second):
                    deadline = time.monotonic() + 5
                    while time.monotonic() < deadline:
                        message = json.loads(client.recv(timeout=3))
                        counts = {status["case_id"]: status["total_samples"] for status in message["data"]["statuses"]}
                        if counts == {"pir": 120, "csi_router": 30, "csi_dedicated": 30}:
                            break
                    else:
                        pytest.fail("Las muestras no llegaron a ambos clientes")
                    assert len(message["data"]["cases"]["pir"]["raw_points"]) == 100
                for case, count in [("pir", 120), ("csi_router", 30), ("csi_dedicated", 30)]:
                    assert len(api.get(f"/telemetry/{case}/history?limit=500").json()) == count
                    assert api.get(f"/metrics/{case}").json()["total_tests"] == 0

                stop(broker)
                wait_for(lambda: not api.get("/health").json()["mqtt_connected"])
                broker = start_broker()
                wait_for(lambda: api.get("/health").json()["mqtt_connected"])
                single("presence/pir/telemetry", json.dumps({"case_id": "pir", "presence": True, "raw_value": 1}),
                       qos=1, hostname="127.0.0.1", port=broker_port)
                wait_for(lambda: api.get("/telemetry/status").json()[0]["total_samples"] == 121)

            trial = api.post("/metrics/trial", json={
                "case_id": "pir", "ground_truth": True, "detected_presence": True, "latency_ms": 12,
            })
            assert trial.status_code == 200
            stop(backend)
            backend = start_backend()
            wait_for(lambda: api.get("/health").json()["mqtt_connected"])
            assert all(status["total_samples"] == 0 for status in api.get("/telemetry/status").json())
            assert len(api.get("/telemetry/pir/history?limit=500").json()) == 121
            assert api.get("/metrics/pir").json()["total_tests"] == 1
            assert api.get("/metrics/pir").json()["detection_rate"] == 100
        finally:
            stop(backend)
            stop(broker)
