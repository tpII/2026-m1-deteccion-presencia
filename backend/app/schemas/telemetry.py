from datetime import datetime, timezone
from pydantic import BaseModel, Field, FiniteFloat
from app.constants import CaseId


class SignalPoint(BaseModel):
    timestamp: float = Field(..., description="Milisegundos desde la época Unix")
    value: float = Field(..., description="Valor numérico de amplitud o estado")


class FilterMetadata(BaseModel):
    name: str = Field(..., description="Nombre del filtro (ej. Hampel + Media Móvil)")
    window_size: int = Field(..., description="Tamaño de la ventana de muestras")
    threshold: float | None = Field(None, description="Umbral de rechazo de outliers (ej. 3 sigma)")
    parameters: dict[str, int | float | str] = Field(default_factory=dict, description="Parámetros adicionales configurados")


class FeatureMetrics(BaseModel):
    variance: float = Field(..., description="Varianza de amplitud en la ventana temporal")
    energy: float = Field(..., description="Energía normalizada de la señal")
    detection_score: float = Field(..., description="Score continuo entre 0 y 1")
    threshold_applied: float = Field(..., description="Umbral de decisión para presencia")
    periodicity_ratio: float = Field(0.0, description="Grado de periodicidad armónica (alto en objetos rotativos como ventiladores)")
    target_type: str = Field("empty", description="Clasificación del objetivo: empty, person_active, person_static, object_fan, object_moved")


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
    filtered_points: list[SignalPoint] | None = None
    filter_metadata: FilterMetadata | None = None
    features: FeatureMetrics | None = None
    current_score: float | None = None
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
