from fastapi import APIRouter

from app.schemas.telemetry import CalibrationInfo, CalibrationRequest
from app.telemetry import telemetry_service

router = APIRouter(prefix="/csi", tags=["CSI"])

@router.get("/csi_router/calibration", response_model=CalibrationInfo)
async def get_calibration():
    return telemetry_service.calibration_info()


@router.post("/csi_router/calibration", response_model=CalibrationInfo)
async def start_calibration(request: CalibrationRequest):
    """Calibra el detector: hay que dejar la habitación vacía durante toda la calibración."""
    return await telemetry_service.start_calibration(
        request.delay_seconds, request.duration_seconds, request.environment,
    )
