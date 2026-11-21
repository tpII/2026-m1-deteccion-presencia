from typing import Annotated, Literal

from pydantic import BaseModel, Field, FiniteFloat, StringConstraints
from app.constants import CaseId

Environment = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
TrialScenario = Literal["absent", "present", "left_of_pir", "right_of_pir", "near_router"]


class CaseMetrics(BaseModel):
    case_id: CaseId
    case_name: str
    total_tests: int = Field(..., description="Cantidad total de ensayos realizados")
    correct_detections: int = Field(..., description="Detecciones correctas (TP + TN)")
    detection_rate: float = Field(..., description="Exactitud porcentual: (TP + TN) / total × 100")
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
    environment: str | None = None
    scenario: TrialScenario | None = None
    observed_at: str | None = None
    sample_received_at: str | None = None
    telemetry_id: int | None = None


class ComparisonTableEntry(BaseModel):
    metric: str
    unit: str
    pir: str | float
    csi_router: str | float


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
    environment: Environment | None = None
