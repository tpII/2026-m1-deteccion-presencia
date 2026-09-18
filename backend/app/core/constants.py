"""Constantes del sistema para detección de presencia."""

from enum import Enum


class CaseId(str, Enum):
    PIR = "pir"
    CSI_ROUTER = "csi_router"
    CSI_DEDICATED = "csi_dedicated"


class DataSourceType(str, Enum):
    MOCK = "mock"
    MQTT = "mqtt"


class ConnectionState(str, Enum):
    ONLINE = "online"
    RECONNECTING = "reconnecting"
    OFFLINE = "offline"


class SystemTopics:
    PIR_TELEMETRY = "presence/pir/telemetry"
    CSI_ROUTER_RAW = "presence/csi/router/raw"
    CSI_ROUTER_PROCESSED = "presence/csi/router/processed"
    CSI_DEDICATED_RAW = "presence/csi/dedicated/raw"
    CSI_DEDICATED_PROCESSED = "presence/csi/dedicated/processed"
    SYSTEM_STATUS = "presence/system/status"


# Parámetros del buffer en memoria
MAX_SERIES_POINTS = 500  # Puntos máximos para series temporales en memoria
DEFAULT_CSI_SUBCARRIERS = 30  # Cantidad estándar de subportadoras OFDM simuladas
DEFAULT_SAMPLING_RATE_HZ = 10  # Frecuencia de muestreo simulada
