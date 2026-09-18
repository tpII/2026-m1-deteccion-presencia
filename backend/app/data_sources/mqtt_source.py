"""Fuente de datos MQTT para conexión con broker Mosquitto y hardware ESP32."""

import asyncio
import json
from typing import Callable, Awaitable, Any, Optional
import paho.mqtt.client as mqtt
from app.data_sources.base import DataSource
from app.core.config import settings
from app.core.constants import SystemTopics, CaseId
from app.schemas.telemetry import TelemetrySample, CsiRawSample
from app.core.logging import logger


class MQTTDataSource(DataSource):
    """
    Cliente MQTT que se suscribe a los tópicos de telemetría de los microcontroladores ESP32.
    Valida y deserializa mensajes entrantes para alimentar el pipeline unificado de procesamiento.
    """

    def __init__(self):
        self._handler: Optional[Callable[[str, Any], Awaitable[None]]] = None
        self._client: Optional[mqtt.Client] = None
        self._loop = None
        self._is_connected = False

    def set_sample_handler(self, handler: Callable[[str, Any], Awaitable[None]]):
        self._handler = handler

    async def start(self):
        self._loop = asyncio.get_running_loop()
        try:
            # Compatibilidad paho-mqtt v2 CallbackAPIVersion
            try:
                self._client = mqtt.Client(
                    mqtt.CallbackAPIVersion.VERSION2,
                    client_id=settings.MQTT_CLIENT_ID,
                )
            except AttributeError:
                self._client = mqtt.Client(client_id=settings.MQTT_CLIENT_ID)

            self._client.on_connect = self._on_connect
            self._client.on_disconnect = self._on_disconnect
            self._client.on_message = self._on_message

            logger.info(f"Conectando a broker MQTT en {settings.MQTT_HOST}:{settings.MQTT_PORT}...")
            self._client.connect_async(settings.MQTT_HOST, settings.MQTT_PORT, settings.MQTT_KEEPALIVE)
            self._client.loop_start()

        except Exception as e:
            logger.error(f"Error al inicializar cliente MQTT: {e}. Se reintentará en segundo plano.")

    async def stop(self):
        if self._client:
            self._client.loop_stop()
            self._client.disconnect()
            logger.info("Cliente MQTT desconectado.")

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        logger.info(f"Conectado a broker MQTT exitosamente (rc={reason_code})")
        self._is_connected = True
        # Suscribir a tópicos de telemetría
        topics = [
            (SystemTopics.PIR_TELEMETRY, 0),
            (SystemTopics.CSI_ROUTER_RAW, 0),
            (SystemTopics.CSI_DEDICATED_RAW, 0),
        ]
        client.subscribe(topics)
        logger.info(f"Suscrito a tópicos: {[t[0] for t in topics]}")

    def _on_disconnect(self, client, userdata, disconnect_flags, reason_code, properties=None):
        logger.warning(f"Desconectado del broker MQTT (rc={reason_code}). Intentando reconexión automática...")
        self._is_connected = False

    def _on_message(self, client, userdata, msg):
        try:
            payload_str = msg.payload.decode("utf-8")
            data = json.loads(payload_str)
            topic = msg.topic

            if topic == SystemTopics.PIR_TELEMETRY:
                sample = TelemetrySample(**data)
                case_id = CaseId.PIR.value
            elif topic == SystemTopics.CSI_ROUTER_RAW:
                sample = CsiRawSample(**data)
                case_id = CaseId.CSI_ROUTER.value
            elif topic == SystemTopics.CSI_DEDICATED_RAW:
                sample = CsiRawSample(**data)
                case_id = CaseId.CSI_DEDICATED.value
            else:
                return

            if self._handler and self._loop and self._loop.is_running():
                asyncio.run_coroutine_threadsafe(self._handler(case_id, sample), self._loop)

        except Exception as e:
            logger.error(f"Error parseando mensaje MQTT de {msg.topic}: {e}")
