from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.repositories import csi_capture_repository as captures
from app.repositories.telemetry_repository import telemetry_repo
from app.schemas.csi_capture import CsiCapture, CsiCaptureComparison, CsiCapturePreview, StartCsiCapture
from app.schemas.metrics import Environment

router = APIRouter(prefix="/csi/captures", tags=["Capturas CSI"])


@router.get("", response_model=CsiCaptureComparison)
async def get_comparison(environment: Environment | None = None):
    as_of = captures.utc_timestamp(datetime.now(timezone.utc))
    await telemetry_repo.flush()
    return await captures.get_comparison(environment, as_of)


@router.post("", response_model=CsiCapture, status_code=201)
async def start_capture(request: StartCsiCapture):
    capture = await captures.start_capture(request)
    if capture is None:
        raise HTTPException(status_code=409, detail="Ya hay una captura CSI en curso.")
    return capture


@router.get("/{capture_id}/preview", response_model=CsiCapturePreview)
async def preview_capture(capture_id: int):
    as_of = captures.utc_timestamp(datetime.now(timezone.utc))
    await telemetry_repo.flush()
    preview = await captures.get_preview(capture_id, as_of)
    if preview is None:
        raise HTTPException(status_code=404, detail="La captura CSI no existe.")
    return preview


@router.post("/{capture_id}/finish", response_model=CsiCapture)
async def finish_capture(capture_id: int):
    capture = await captures.finish_capture(capture_id)
    if capture is None:
        raise HTTPException(status_code=404, detail="La captura CSI no existe.")
    return capture
