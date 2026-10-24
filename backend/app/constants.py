from enum import Enum


class CaseId(str, Enum):
    PIR = "pir"
    CSI_ROUTER = "csi_router"
    CSI_DEDICATED = "csi_dedicated"


class SystemTopics:
    PIR_TELEMETRY = "presence/pir/telemetry"
    CSI_ROUTER_RAW = "presence/csi/router/raw"
    CSI_DEDICATED_RAW = "presence/csi/dedicated/raw"


CASE_NAMES = {
    CaseId.PIR: "Caso 1 — Sensor PIR",
    CaseId.CSI_ROUTER: "Caso 2 — CSI con Router Wi-Fi",
    CaseId.CSI_DEDICATED: "Caso 3 — CSI en Red Dedicada (AP-STA)",
}

MAX_SERIES_POINTS = 500
DISPLAY_POINTS = 100
CONNECTION_TIMEOUT_SECONDS = 10
