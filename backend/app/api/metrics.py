from fastapi import APIRouter, Query

from app.constants import CaseId
from app.repositories.metrics_repository import metrics_repo
from app.schemas.metrics import CaseMetrics, RecordTrialRequest, SystemComparison, Trial

router = APIRouter(prefix="/metrics", tags=["Métricas y Comparación"])


@router.get("/comparison", response_model=SystemComparison)
async def get_comparison_summary():
    return await metrics_repo.get_system_comparison()


@router.get("/{case_id}", response_model=CaseMetrics)
async def get_metrics_for_case(case_id: CaseId):
    return await metrics_repo.calculate_case_metrics(case_id)


@router.get("/{case_id}/trials", response_model=list[Trial])
async def get_case_trials(case_id: CaseId, limit: int = Query(default=50, ge=1, le=500)):
    return await metrics_repo.get_trials_by_case(case_id, limit)


@router.post("/trial", response_model=Trial)
async def record_trial(request: RecordTrialRequest):
    return await metrics_repo.add_trial(**request.model_dump())
