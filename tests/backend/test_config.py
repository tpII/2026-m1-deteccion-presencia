"""Pruebas unitarias para la configuración de nodos ESP32."""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.schemas.config import channel_to_mhz


def test_channel_to_mhz_calculation():
    assert channel_to_mhz(1) == 2412
    assert channel_to_mhz(6) == 2437
    assert channel_to_mhz(11) == 2462
    assert channel_to_mhz(13) == 2472


@pytest.mark.asyncio
async def test_get_nodes_config_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/config/nodes")
        assert res.status_code == 200
        data = res.json()
        assert "broker_host" in data
        assert "broker_port" in data
        assert "pir" in data
        assert "csi_router" in data
        assert "csi_dedicated" in data
        assert data["csi_router"]["frequency_mhz"] == 2437
        assert data["csi_dedicated"]["frequency_mhz"] == 2412


@pytest.mark.asyncio
async def test_update_nodes_config_endpoint(monkeypatch):
    monkeypatch.setattr("paho.mqtt.publish.multiple", lambda *args, **kwargs: None)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "broker_host": "192.168.1.50",
            "broker_port": 1883,
            "pir": {
                "node_id": "esp32_pir_node_01",
                "gpio_pin": 27,
                "trigger_mode": "RISING",
                "debounce_ms": 2500,
                "sample_interval_ms": 150,
                "mqtt_topic": "presence/pir/telemetry",
            },
            "csi_router": {
                "node_id": "esp32_csi_sta_node",
                "wifi_channel": 11,
                "target_ssid": "Lab-WiFi-Test",
                "target_bssid": "",
                "sampling_rate_hz": 50,
                "subcarriers_mode": "PRIMARY",
                "mqtt_topic": "presence/csi/router/raw",
            },
            "csi_dedicated": {
                "node_id": "esp32_dedicated_pair",
                "wifi_channel": 6,
                "tx_power_dbm": 18,
                "packet_rate_hz": 50,
                "custom_bssid": "02:00:00:00:00:01",
                "mqtt_topic": "presence/csi/dedicated/raw",
            },
        }
        res = await client.post("/api/v1/config/nodes", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "updated"
        assert data["config"]["broker_host"] == "192.168.1.50"
        assert data["config"]["pir"]["gpio_pin"] == 27
        assert data["config"]["csi_router"]["wifi_channel"] == 11
        assert data["config"]["csi_router"]["frequency_mhz"] == 2462


@pytest.mark.asyncio
async def test_c_header_generation_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. PIR Header
        res = await client.get("/api/v1/config/header/pir")
        assert res.status_code == 200
        data = res.json()
        assert "config_pir.h" in data["filename"]
        assert "#define PIR_GPIO_PIN" in data["content"]

        # 2. CSI Router Header
        res = await client.get("/api/v1/config/header/csi_router")
        assert res.status_code == 200
        data = res.json()
        assert "config_csi_router.h" in data["filename"]
        assert "#define WIFI_CHANNEL" in data["content"]
        assert "#define WIFI_FREQ_MHZ" in data["content"]

        # 3. CSI Dedicated Header
        res = await client.get("/api/v1/config/header/csi_dedicated")
        assert res.status_code == 200
        data = res.json()
        assert "config_csi_dedicated.h" in data["filename"]
        assert "#define DEDICATED_WIFI_CHANNEL" in data["content"]
