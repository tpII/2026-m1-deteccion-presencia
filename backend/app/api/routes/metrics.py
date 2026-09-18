"""Rutas REST para métricas experimentales, comparación y ensayos con Ground Truth."""

from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends
from app.core.constants import CaseId
from app.schemas.metrics import CaseMetrics, SystemComparison, Trial
from app.services.metrics_service import MetricsService
from app.api.dependencies import get_metrics_service

router = APIRouter(prefix="/metrics", tags=["Métricas y Comparación"])


class RecordTrialRequest(BaseModel):
    case_id: CaseId
    ground_truth: bool = Field(..., description="Presencia real verificada en el ensayo")
    detected_presence: bool = Field(..., description="Presencia detectada por el sensor/algoritmo")
    latency_ms: float = Field(..., description="Latencia en milisegundos observada")
    score: Optional[float] = None
    notes: Optional[str] = None


@router.get("/comparison", response_model=SystemComparison)
async def get_comparison_summary(metrics_svc: MetricsService = Depends(get_metrics_service)):
    """Retorna la tabla comparativa académica entre los tres métodos de detección."""
    return await metrics_svc.get_system_comparison()


@router.get("/{case_id}", response_model=CaseMetrics)
async def get_metrics_for_case(case_id: str, metrics_svc: MetricsService = Depends(get_metrics_service)):
    """Retorna las métricas consolidadas (tasa de detección, FP, FN, latencia) de un caso."""
    valid_ids = [c.value for c in CaseId]
    if case_id not in valid_ids:
        raise HTTPException(status_code=404, detail=f"Caso '{case_id}' no encontrado.")
    return await metrics_svc.get_case_metrics(case_id)


@router.get("/{case_id}/trials", response_model=List[Trial])
async def get_case_trials(
    case_id: str,
    limit: int = 50,
    metrics_svc: MetricsService = Depends(get_metrics_service),
):
    """Retorna el historial de ensayos experimentales evaluados contra Ground Truth."""
    valid_ids = [c.value for c in CaseId]
    if case_id not in valid_ids:
        raise HTTPException(status_code=404, detail=f"Caso '{case_id}' no encontrado.")
    return await metrics_svc.get_trials(case_id, limit=limit)


@router.post("/trial", response_model=Trial)
async def record_trial(
    req: RecordTrialRequest,
    metrics_svc: MetricsService = Depends(get_metrics_service),
):
    """Registra un nuevo ensayo experimental y actualiza las métricas en SQLite."""
    return await metrics_svc.record_trial(
        case_id=req.case_id.value,
        ground_truth=req.ground_truth,
        detected_presence=req.detected_presence,
        latency_ms=req.latency_ms,
        score=req.score,
        notes=req.notes,
    )
