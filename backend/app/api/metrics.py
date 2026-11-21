from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.constants import CaseId
from app.repositories.metrics_repository import metrics_repo
from app.repositories.telemetry_repository import telemetry_repo
from app.schemas.metrics import CaseMetrics, RecordLiveTrialRequest, RecordTrialRequest, SystemComparison, Trial

router = APIRouter(prefix="/metrics", tags=["Métricas y Comparación"])


@router.get("/comparison", response_model=SystemComparison)
async def get_comparison_summary():
    return await metrics_repo.get_system_comparison()


@router.post("/trial/live", response_model=Trial)
async def record_live_trial(request: RecordLiveTrialRequest):
    received_at = datetime.now(timezone.utc).isoformat(timespec="microseconds")
    sample = await telemetry_repo.get_trial_sample(request.case_id, request.sample_key)
    if sample is None or (request.case_id == CaseId.CSI_ROUTER and sample["calibration_state"] != "calibrado"):
        raise HTTPException(status_code=409, detail="La muestra indicada no está disponible para el ensayo.")
    return await metrics_repo.add_trial(
        case_id=request.case_id,
        environment=request.environment,
        scenario=request.scenario,
        ground_truth=request.scenario != "absent",
        detected_presence=bool(sample["presence"]),
        latency_ms=sample["latency_ms"],
        received_at=received_at,
        observed_at=request.observed_at.astimezone(timezone.utc).isoformat(timespec="milliseconds"),
        sample_received_at=sample["timestamp"],
        telemetry_id=sample["id"],
    )


@router.get("/{case_id}", response_model=CaseMetrics)
async def get_metrics_for_case(case_id: CaseId):
    return await metrics_repo.calculate_case_metrics(case_id)


@router.get("/{case_id}/trials", response_model=list[Trial])
async def get_case_trials(case_id: CaseId, limit: int = Query(default=50, ge=1, le=500)):
    return await metrics_repo.get_trials_by_case(case_id, limit)


@router.post("/trial", response_model=Trial)
async def record_trial(request: RecordTrialRequest):
    return await metrics_repo.add_trial(**request.model_dump())
