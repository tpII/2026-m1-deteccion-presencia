"""Esquemas Pydantic para métricas comparativas y ensayos experimentales."""

from typing import List, Optional
from pydantic import BaseModel, Field
from app.core.constants import CaseId


class CaseMetrics(BaseModel):
    """Métricas experimentales acumuladas para un método."""
    case_id: CaseId
    case_name: str
    total_tests: int = Field(..., description="Cantidad total de ensayos realizados")
    correct_detections: int = Field(..., description="Detecciones correctas (TP + TN)")
    detection_rate: float = Field(..., description="Tasa de detección porcentual (0 - 100%)")
    false_positives: int = Field(..., description="Falsos positivos (FP)")
    false_negatives: int = Field(..., description="Falsos negativos (FN)")
    average_latency_ms: float = Field(..., description="Latencia media en milisegundos")
    precision: Optional[float] = Field(None, description="Precisión (TP / (TP + FP))")
    recall: Optional[float] = Field(None, description="Recall (TP / (TP + FN))")
    f1_score: Optional[float] = Field(None, description="F1 Score")


class Trial(BaseModel):
    """Registro individual de un ensayo experimental con Ground Truth."""
    id: int
    case_id: CaseId
    timestamp: str
    ground_truth: bool = Field(..., description="Valor real: presencia o ausencia")
    detected_presence: bool = Field(..., description="Decisión emitida por el algoritmo")
    is_correct: bool = Field(..., description="Verdadero si coincide con Ground Truth")
    latency_ms: float
    score: Optional[float] = None
    notes: Optional[str] = None


class ComparisonTableEntry(BaseModel):
    """Fila de la tabla comparativa académica."""
    metric: str
    unit: str
    pir: str | float
    csi_router: str | float
    csi_dedicated: str | float


class SystemComparison(BaseModel):
    """Resumen de comparación entre los 3 métodos para la vista de investigación."""
    metrics: List[CaseMetrics]
    table: List[ComparisonTableEntry]
    last_updated: str
