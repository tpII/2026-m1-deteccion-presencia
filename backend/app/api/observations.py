from fastapi import APIRouter

from app.repositories.observation_repository import get_report, record_observation
from app.schemas.metrics import Environment
from app.schemas.observations import MeasuredCase, Observation, ObservationInput, ObservationReport
from app.telemetry import telemetry_service

router = APIRouter(prefix="/observations", tags=["Observaciones"])


@router.post("", response_model=Observation, status_code=201)
async def save_observation(request: ObservationInput):
    return await record_observation(request, telemetry_service.run_id)


@router.get("/{case_id}", response_model=ObservationReport)
async def observation_report(case_id: MeasuredCase, environment: Environment):
    await telemetry_service.repository.flush()
    return await get_report(case_id, environment)
