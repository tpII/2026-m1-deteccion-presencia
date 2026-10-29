from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, FiniteFloat
from app.constants import CaseId
from app.signal_processing.presence_detector import CALIBRATION_DELAY_SECONDS, CALIBRATION_SECONDS


class SignalPoint(BaseModel):
    timestamp: float = Field(..., description="Milisegundos desde la época Unix")
    value: float = Field(..., description="Valor numérico de amplitud o estado")


class FeatureMetrics(BaseModel):
    """Indicadores del detector CSI (ver app/signal_processing/presence_detector.py)."""
    movement_index: float | None = Field(None, description="Desvío de la turbulencia en la ventana")
    movement_threshold: float | None = Field(None, description="Umbral calibrado del indicador de movimiento")
    shape_index: float | None = Field(None, description="Distancia al perfil del canal vacío, promediada en la ventana")
    shape_threshold: float | None = Field(None, description="Umbral calibrado del indicador de forma")
    detection_ratio: float = Field(0.0, description="Indicador / umbral del más alto de los dos; >= 1 es presencia")


class CalibrationInfo(BaseModel):
    state: Literal["sin_calibrar", "esperando", "calibrando", "calibrado"]
    message: str
    progress: float = Field(..., ge=0, le=1, description="Avance de la etapa actual")
    seconds_remaining: float = Field(..., ge=0)


class CalibrationRequest(BaseModel):
    delay_seconds: float = Field(CALIBRATION_DELAY_SECONDS, ge=0, le=120, description="Tiempo para salir de la habitación")
    duration_seconds: float = Field(CALIBRATION_SECONDS, ge=10, le=300, description="Tiempo registrando la habitación vacía")


class TelemetrySample(BaseModel):
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat(), description="ISO timestamp UTC")
    case_id: CaseId = Field(..., description="Identificador del método experimental")
    source: str = Field("hardware", description="Identificador del hardware ESP32")
    presence: bool = Field(..., description="Estado de presencia detectado")
    raw_value: FiniteFloat = Field(..., description="Valor numérico (0/1 para PIR, magnitud para CSI)")
    latency_ms: FiniteFloat = Field(0.0, ge=0, description="Latencia medida en milisegundos")
    ground_truth: bool | None = Field(None, description="Ground truth experimental si está disponible")


class CsiRawSample(BaseModel):
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    case_id: CaseId
    source: str = "esp32"
    amplitudes: list[FiniteFloat] = Field(..., min_length=1, description="Subportadoras OFDM o serie temporal de amplitudes")
    latency_ms: FiniteFloat = Field(default=0.0, ge=0)
    ground_truth: bool | None = None


class CaseCurrentStatus(BaseModel):
    case_id: CaseId
    name: str
    is_connected: bool
    presence: bool
    current_latency_ms: float
    last_updated: str
    total_samples: int
    target_type: str | None = None


class CaseTelemetryPayload(BaseModel):
    case_id: CaseId
    presence: bool
    latency_ms: float
    raw_points: list[SignalPoint]
    movement_points: list[SignalPoint] | None = None
    shape_points: list[SignalPoint] | None = None
    features: FeatureMetrics | None = None
    calibration: CalibrationInfo | None = None
    ground_truth: bool | None = None
    target_type: str | None = None


class TelemetryHistoryRecord(BaseModel):
    id: int
    case_id: CaseId
    timestamp: str
    presence: bool
    raw_value: float
    latency_ms: float
    score: float | None = None
