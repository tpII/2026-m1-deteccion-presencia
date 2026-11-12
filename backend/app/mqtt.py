import asyncio
from collections.abc import Awaitable, Callable
from concurrent.futures import Future
import paho.mqtt.client as mqtt
from app.config import settings
from app.constants import SystemTopics, CaseId
from app.schemas.telemetry import TelemetrySample, CsiRawSample
from app.logging_config import logger


SampleHandler = Callable[[str, TelemetrySample | CsiRawSample], Awaitable[None]]
TOPIC_SCHEMAS = {
    SystemTopics.PIR_TELEMETRY: (CaseId.PIR, TelemetrySample),
    SystemTopics.CSI_ROUTER_RAW: (CaseId.CSI_ROUTER, CsiRawSample),
    SystemTopics.CSI_DEDICATED_RAW: (CaseId.CSI_DEDICATED, CsiRawSample),
}
STATUS_TOPICS = {
    SystemTopics.PIR_STATUS: CaseId.PIR,
    SystemTopics.CSI_ROUTER_STATUS: CaseId.CSI_ROUTER,
}


class MQTTDataSource:
    def __init__(self):
        self._handler: SampleHandler | None = None
        self._status_handler: Callable[[str, bool], None] | None = None
        self._connection_handler: Callable[[bool], None] | None = None
        self._client: mqtt.Client | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._pending: set[Future[None]] = set()
        self._is_connected = False

    def set_sample_handler(self, handler: SampleHandler):
        self._handler = handler

    def set_status_handler(self, handler: Callable[[str, bool], None]):
        self._status_handler = handler

    def set_connection_handler(self, handler: Callable[[bool], None]):
        self._connection_handler = handler

    def _notify_connection(self, connected: bool):
        self._is_connected = connected
        if self._connection_handler and self._loop and self._loop.is_running():
            self._loop.call_soon_threadsafe(self._connection_handler, connected)

    async def start(self):
        self._loop = asyncio.get_running_loop()
        try:
            self._client = mqtt.Client(
                mqtt.CallbackAPIVersion.VERSION2,
                client_id=settings.MQTT_CLIENT_ID,
            )

            self._client.on_connect = self._on_connect
            self._client.on_disconnect = self._on_disconnect
            self._client.on_message = self._on_message

            logger.info(f"Conectando a broker MQTT en {settings.MQTT_HOST}:{settings.MQTT_PORT}...")
            self._client.connect_async(settings.MQTT_HOST, settings.MQTT_PORT, settings.MQTT_KEEPALIVE)
            self._client.loop_start()

        except Exception:
            logger.exception("No se pudo inicializar el cliente MQTT")
            raise

    async def stop(self):
        if self._client:
            await asyncio.to_thread(self._client.disconnect)
            await asyncio.to_thread(self._client.loop_stop)
            self._notify_connection(False)
            await asyncio.gather(*(asyncio.wrap_future(task) for task in list(self._pending)), return_exceptions=True)
            logger.info("Cliente MQTT desconectado.")

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        if reason_code != 0:
            self._notify_connection(False)
            logger.error(f"El broker rechazo la conexion MQTT (rc={reason_code})")
            return
        logger.info(f"Conectado a broker MQTT exitosamente (rc={reason_code})")
        self._notify_connection(True)
        topics = [(topic, 0) for topic in TOPIC_SCHEMAS]
        topics.extend((topic, 1) for topic in STATUS_TOPICS)
        client.subscribe(topics)
        logger.info(f"Suscrito a tópicos: {[t[0] for t in topics]}")

    def _on_disconnect(self, client, userdata, disconnect_flags, reason_code, properties=None):
        logger.info("MQTT desconectado (rc=%s)", reason_code)
        self._notify_connection(False)

    def _on_message(self, client, userdata, msg):
        if msg.topic in STATUS_TOPICS:
            if msg.payload not in (b"online", b"offline"):
                logger.warning("Estado MQTT inválido en %s: se espera online/offline", msg.topic)
                return
            if self._status_handler and self._loop and self._loop.is_running():
                self._loop.call_soon_threadsafe(
                    self._status_handler, STATUS_TOPICS[msg.topic], msg.payload == b"online",
                )
            return
        if msg.topic not in TOPIC_SCHEMAS:
            return
        case_id, schema = TOPIC_SCHEMAS[msg.topic]
        try:
            sample = schema.model_validate_json(msg.payload)
            if sample.case_id != case_id:
                raise ValueError("case_id no coincide con el tópico MQTT")
        except ValueError as error:
            logger.warning("Mensaje MQTT inválido en %s: %s", msg.topic, error)
            return

        if self._handler and self._loop and self._loop.is_running():
            task = asyncio.run_coroutine_threadsafe(self._handler(case_id, sample), self._loop)
            self._pending.add(task)
            task.add_done_callback(self._sample_finished)

    def _sample_finished(self, task: Future[None]) -> None:
        self._pending.discard(task)
        if task.cancelled():
            return
        try:
            task.result()
        except Exception:
            logger.exception("No se pudo procesar la muestra MQTT")

    @property
    def is_connected(self) -> bool:
        return self._is_connected
