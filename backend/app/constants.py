from enum import Enum


class CaseId(str, Enum):
    PIR = "pir"
    CSI_ROUTER = "csi_router"


class SystemTopics:
    PIR_TELEMETRY = "sensores/pir/presencia"
    PIR_STATUS = "sensores/pir/estado_esp32"
    CSI_ROUTER_RAW = "sensores/csi/amplitudes"
    CSI_ROUTER_STATUS = "sensores/csi/estado_esp32"


CASE_NAMES = {
    CaseId.PIR: "Caso 1 — Sensor PIR",
    CaseId.CSI_ROUTER: "Caso 2 — CSI con Router Wi-Fi",
}

MAX_SERIES_POINTS = 500
DISPLAY_POINTS = 100
INDICATOR_DISPLAY_POINTS = 300  # ~30 s de indicadores CSI a 10 paquetes/s
CONNECTION_TIMEOUT_SECONDS = 10
TELEMETRY_FLUSH_INTERVAL_SECONDS = 2
