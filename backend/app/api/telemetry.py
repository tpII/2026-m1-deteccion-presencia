from datetime import timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import AwareDatetime

from app.constants import CaseId
from app.repositories.sample_history_repository import get_sample_history
from app.repositories.telemetry_repository import telemetry_repo
from app.schemas.telemetry import CaseCurrentStatus, CaseTelemetryPayload, StoredSamplePage, TelemetryHistoryRecord
from app.telemetry_state import telemetry_state

router = APIRouter(prefix="/telemetry", tags=["Telemetría"])


@router.get("/status", response_model=list[CaseCurrentStatus])
async def get_all_case_statuses():
    return telemetry_state.get_all_statuses()


@router.get("/history", response_model=StoredSamplePage)
async def get_persisted_samples(
    start: AwareDatetime,
    end: AwareDatetime,
    case_id: CaseId | None = None,
    before: int | None = Query(default=None, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
):
    if start >= end:
        raise HTTPException(status_code=422, detail="El inicio debe ser anterior al fin.")
    # Las fechas de SQLite están en UTC. El prefijo incluye el instante exacto
    # al inicio del intervalo para las representaciones ISO con o sin fracción.
    start_utc = start.astimezone(timezone.utc).replace(tzinfo=None).isoformat()
    end_utc = end.astimezone(timezone.utc).replace(tzinfo=None).isoformat()
    return await get_sample_history(start_utc, end_utc, case_id, before, limit)


@router.get("/{case_id}", response_model=CaseTelemetryPayload)
async def get_case_telemetry(case_id: CaseId):
    return telemetry_state.get_payload(case_id)


@router.get("/{case_id}/history", response_model=list[TelemetryHistoryRecord])
async def get_case_persisted_history(case_id: CaseId, limit: int = Query(default=50, ge=1, le=500)):
    return await telemetry_repo.get_history(case_id, limit)
