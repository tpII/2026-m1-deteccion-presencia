from typing import Literal

from fastapi import APIRouter

from app.schemas.telemetry import CalibrationInfo, CalibrationRequest
from app.telemetry import telemetry_service

router = APIRouter(prefix="/csi", tags=["CSI"])

CsiCaseId = Literal["csi_router", "csi_dedicated"]


@router.get("/{case_id}/calibration", response_model=CalibrationInfo)
async def get_calibration(case_id: CsiCaseId):
    return telemetry_service.calibration_info(case_id)


@router.post("/{case_id}/calibration", response_model=CalibrationInfo)
async def start_calibration(case_id: CsiCaseId, request: CalibrationRequest | None = None):
    """Calibra el detector: hay que dejar la habitación vacía durante toda la calibración."""
    request = request or CalibrationRequest()
    return telemetry_service.start_calibration(case_id, request.delay_seconds, request.duration_seconds)
