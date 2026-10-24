from fastapi import APIRouter, Query
from app.repositories import pir_usb_repository
from app.schemas.pir_usb import PirUsbBatch, PirUsbRecord, PirUsbSaveResult

router = APIRouter(prefix="/pir-usb", tags=["Prueba PIR USB"])


@router.post("/readings", response_model=PirUsbSaveResult)
async def save_pir_usb_readings(batch: PirUsbBatch):
    return PirUsbSaveResult(saved_count=await pir_usb_repository.save_readings(batch.readings))


@router.get("/readings", response_model=list[PirUsbRecord])
async def get_pir_usb_history(limit: int = Query(default=50, ge=1, le=500)):
    return await pir_usb_repository.get_history(limit)
