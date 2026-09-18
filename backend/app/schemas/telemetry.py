"""Esquemas de datos Pydantic para telemetría y procesamiento de señal."""

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.core.constants import CaseId


class SignalPoint(BaseModel):
    """Punto temporal en una serie de señal."""
    timestamp: float = Field(..., description="Timestamp en milisegundos o época Unix")
    value: float = Field(..., description="Valor numérico de amplitud o estado")


class FilterMetadata(BaseModel):
    """Metadatos del filtro aplicado a la señal."""
    name: str = Field(..., description="Nombre del filtro (ej. Hampel + Media Móvil)")
    window_size: int = Field(..., description="Tamaño de la ventana de muestras")
    threshold: Optional[float] = Field(None, description="Umbral de rechazo de outliers (ej. 3 sigma)")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Parámetros adicionales configurados")


class FeatureMetrics(BaseModel):
    """Características extraídas de la señal CSI."""
    variance: float = Field(..., description="Varianza de amplitud en la ventana temporal")
    energy: float = Field(..., description="Energía normalizada de la señal")
    detection_score: float = Field(..., description="Score continuo entre 0 y 1")
    threshold_applied: float = Field(..., description="Umbral de decisión para presencia")


class TelemetrySample(BaseModel):
    """Muestra básica de telemetría (caso PIR o estado general)."""
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat(), description="ISO timestamp UTC")
    case_id: CaseId = Field(..., description="Identificador del método experimental")
    source: str = Field("hardware", description="'mock' o identificador de hardware ESP32")
    presence: bool = Field(..., description="Estado de presencia detectado")
    raw_value: float = Field(..., description="Valor numérico (0/1 para PIR, magnitud para CSI)")
    latency_ms: float = Field(0.0, description="Latencia medida en milisegundos")
    ground_truth: Optional[bool] = Field(None, description="Ground truth experimental si está disponible")


class CsiRawSample(BaseModel):
    """Muestra cruda de CSI recibida por MQTT o Mock."""
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    case_id: CaseId
    source: str = "esp32"
    amplitudes: List[float] = Field(..., description="Subportadoras OFDM o serie temporal de amplitudes")
    latency_ms: float = 0.0
    ground_truth: Optional[bool] = None


class CsiProcessedSample(BaseModel):
    """Muestra completa procesada con señal cruda, filtrada, métricas y decisión."""
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    case_id: CaseId
    source: str
    raw_amplitudes: List[float]
    filtered_amplitudes: List[float]
    filter_metadata: FilterMetadata
    features: FeatureMetrics
    presence: bool
    latency_ms: float
    ground_truth: Optional[bool] = None


class CaseCurrentStatus(BaseModel):
    """Estado instantáneo para cada uno de los 3 casos en el Dashboard."""
    case_id: CaseId
    name: str
    is_connected: bool
    presence: bool
    current_latency_ms: float
    last_updated: str
    total_samples: int


class CaseTelemetryPayload(BaseModel):
    """Carga de telemetría en tiempo real por caso."""
    case_id: str
    presence: bool
    latency_ms: float
    raw_points: List[SignalPoint]
    filtered_points: Optional[List[SignalPoint]] = None
    filter_metadata: Optional[FilterMetadata] = None
    features: Optional[FeatureMetrics] = None
    current_score: Optional[float] = None
    ground_truth: Optional[bool] = None


class TelemetryHistoryRecord(BaseModel):
    """Registro de telemetría persistido en SQLite."""
    id: int
    case_id: str
    timestamp: str
    presence: bool
    raw_value: float
    latency_ms: float
    score: Optional[float] = None

