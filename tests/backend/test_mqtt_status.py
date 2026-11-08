"""Disponibilidad MQTT separada de las muestras y del estado de presencia."""

import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.mqtt import MQTTDataSource, STATUS_TOPICS, TOPIC_SCHEMAS
from app.telemetry_state import TelemetryState


def statuses(state):
    return {status.case_id: status for status in state.get_all_statuses()}


def test_subscription_uses_qos_one_only_for_device_status():
    source = MQTTDataSource()
    client = Mock()
    source._on_connect(client, None, None, 0)
    client.subscribe.assert_called_once_with(
        [(topic, 0) for topic in TOPIC_SCHEMAS] + [(topic, 1) for topic in STATUS_TOPICS],
    )


@pytest.mark.parametrize("topic, case_id", STATUS_TOPICS.items())
async def test_status_messages_reach_dashboard_without_creating_samples(topic, case_id):
    state = TelemetryState()
    source = MQTTDataSource()
    source._loop = asyncio.get_running_loop()
    source.set_status_handler(state.set_device_connection)
    sample_handler = Mock()
    source.set_sample_handler(sample_handler)
    for payload, connected in [(b"online", True), (b"online", True), (b"offline", False)]:
        source._on_message(None, None, SimpleNamespace(topic=topic, payload=payload, retain=True))
        await asyncio.sleep(0)
        message = state.get_message("telemetry_batch")
        status = next(item for item in message["data"]["statuses"] if item["case_id"] == case_id)
        assert status["is_connected"] is connected
        assert status["total_samples"] == 0
        assert status["presence"] is False
        assert message["data"]["cases"][case_id]["raw_points"] == []
    sample_handler.assert_not_called()


@pytest.mark.parametrize("payload", [b"", b"ONLINE", b"true", b'{"status":"online"}', b"\xff"])
async def test_invalid_status_does_not_change_connection(payload):
    state = TelemetryState()
    source = MQTTDataSource()
    source._loop = asyncio.get_running_loop()
    source.set_status_handler(state.set_device_connection)
    source._on_message(None, None, SimpleNamespace(topic="sensores/pir/estado_esp32", payload=payload))
    await asyncio.sleep(0)
    assert statuses(state)["pir"].is_connected is False


def test_explicit_status_overrides_sample_timeout_and_late_samples():
    state = TelemetryState()
    state.update_case_state("pir", True, 0)
    state.set_device_connection("pir", True)
    statuses(state)["pir"].last_updated = (datetime.now(timezone.utc) - timedelta(seconds=30)).isoformat()
    assert statuses(state)["pir"].is_connected is True
    state.set_device_connection("pir", False)
    state.update_case_state("pir", False, 0)
    assert statuses(state)["pir"].is_connected is False
    state.set_device_connection("pir", True)
    assert statuses(state)["pir"].is_connected is True


async def test_broker_disconnect_invalidates_states_until_new_status_or_sample():
    state = TelemetryState()
    source = MQTTDataSource()
    source._loop = asyncio.get_running_loop()
    source.set_connection_handler(state.set_broker_connection)
    state.update_case_state("pir", True, 0)
    state.set_device_connection("csi_router", True)
    source._on_disconnect(None, None, None, 1)
    await asyncio.sleep(0)
    assert all(not status.is_connected for status in statuses(state).values())
    source._on_connect(Mock(), None, None, 0)
    await asyncio.sleep(0)
    assert all(not status.is_connected for status in statuses(state).values())
    state.set_device_connection("csi_router", True)
    state.update_case_state("pir", True, 0)
    assert statuses(state)["pir"].is_connected is True
    assert statuses(state)["csi_router"].is_connected is True
