from fastapi import APIRouter, Query

from app.constants import CaseId
from app.repositories.telemetry_repository import telemetry_repo
from app.schemas.telemetry import CaseCurrentStatus, CaseTelemetryPayload, TelemetryHistoryRecord
from app.telemetry_state import telemetry_state

router = APIRouter(prefix="/telemetry", tags=["Telemetría"])


@router.get("/status", response_model=list[CaseCurrentStatus])
async def get_all_case_statuses():
    return telemetry_state.get_all_statuses()


@router.get("/{case_id}", response_model=CaseTelemetryPayload)
async def get_case_telemetry(case_id: CaseId):
    return telemetry_state.get_payload(case_id)


@router.get("/{case_id}/history", response_model=list[TelemetryHistoryRecord])
async def get_case_persisted_history(case_id: CaseId, limit: int = Query(default=50, ge=1, le=500)):
    return await telemetry_repo.get_history(case_id, limit)
