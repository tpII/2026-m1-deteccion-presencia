"""Contrato entre firmware/publicador MQTT y la ingesta del backend."""

import asyncio
import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock
import pytest
from app.data_sources.mqtt_source import MQTTDataSource
from app.repositories.telemetry_repository import InMemoryTelemetryRepository


def test_broker_rejection_does_not_mark_connected_or_subscribe():
    source = MQTTDataSource()
    client = Mock()
    source._on_connect(client, None, None, 5)
    assert source.is_connected is False
    client.subscribe.assert_not_called()
    source._on_connect(client, None, None, 0)
    assert source.is_connected is True
    client.subscribe.assert_called_once()
    source._on_disconnect(client, None, None, 0)
    assert source.is_connected is False


@pytest.mark.asyncio
async def test_minimal_firmware_payload_reaches_handler():
    source = MQTTDataSource()
    source._loop = asyncio.get_running_loop()
    result = []
    received = asyncio.Event()

    async def handler(case_id, sample):
        result.append((case_id, sample))
        received.set()

    source.set_sample_handler(handler)
    payload = {"case_id": "pir", "source": "pir-94e68605a918", "presence": False, "raw_value": 0}
    source._on_message(None, None, SimpleNamespace(topic="presence/pir/telemetry", payload=json.dumps(payload).encode()))
    await asyncio.wait_for(received.wait(), timeout=1)
    case_id, sample = result[0]
    assert case_id == "pir"
    assert sample.presence is False
    assert sample.raw_value == 0
    assert sample.latency_ms == 0
    assert sample.ground_truth is None
    assert datetime.fromisoformat(sample.timestamp).tzinfo is not None


@pytest.mark.parametrize("payload", [
    b"not JSON",
    b'{"case_id":"csi_router","presence":true,"raw_value":1}',
    b'{"case_id":"pir","presence":true}',
])
def test_invalid_message_is_not_forwarded(payload):
    source = MQTTDataSource()
    source._loop = Mock()
    handler = Mock()
    source.set_sample_handler(handler)
    source._on_message(None, None, SimpleNamespace(topic="presence/pir/telemetry", payload=payload))
    handler.assert_not_called()


def test_case_is_connected_only_after_recent_samples():
    repo = InMemoryTelemetryRepository()
    assert all(not status.is_connected for status in repo.get_all_statuses())
    repo.update_case_state("pir", presence=True, latency_ms=0)
    statuses = {status.case_id.value: status for status in repo.get_all_statuses()}
    assert statuses["pir"].is_connected is True
    assert statuses["csi_router"].is_connected is False
    statuses["pir"].last_updated = (datetime.now(timezone.utc) - timedelta(seconds=11)).isoformat()
    assert all(not status.is_connected for status in repo.get_all_statuses())
