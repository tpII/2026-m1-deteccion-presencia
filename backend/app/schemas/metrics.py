from pydantic import BaseModel, Field, FiniteFloat
from app.constants import CaseId


class CaseMetrics(BaseModel):
    case_id: CaseId
    case_name: str
    total_tests: int = Field(..., description="Cantidad total de ensayos realizados")
    correct_detections: int = Field(..., description="Detecciones correctas (TP + TN)")
    detection_rate: float = Field(..., description="Tasa de detección porcentual (0 - 100%)")
    false_positives: int = Field(..., description="Falsos positivos (FP)")
    false_negatives: int = Field(..., description="Falsos negativos (FN)")
    average_latency_ms: float = Field(..., description="Latencia media en milisegundos")
    precision: float | None = Field(None, description="Precisión (TP / (TP + FP))")
    recall: float | None = Field(None, description="Recall (TP / (TP + FN))")
    f1_score: float | None = Field(None, description="F1 Score")


class Trial(BaseModel):
    id: int
    case_id: CaseId
    timestamp: str
    ground_truth: bool = Field(..., description="Valor real: presencia o ausencia")
    detected_presence: bool = Field(..., description="Decisión emitida por el algoritmo")
    is_correct: bool = Field(..., description="Verdadero si coincide con Ground Truth")
    latency_ms: float
    score: float | None = None
    notes: str | None = None


class ComparisonTableEntry(BaseModel):
    metric: str
    unit: str
    pir: str | float
    csi_router: str | float
    csi_dedicated: str | float


class SystemComparison(BaseModel):
    metrics: list[CaseMetrics]
    table: list[ComparisonTableEntry]
    last_updated: str


class RecordTrialRequest(BaseModel):
    case_id: CaseId
    ground_truth: bool
    detected_presence: bool
    latency_ms: FiniteFloat = Field(ge=0)
    score: FiniteFloat | None = Field(default=None, ge=0, le=1)
    notes: str | None = None
