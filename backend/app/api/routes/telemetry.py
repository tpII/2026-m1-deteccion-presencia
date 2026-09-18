"""Rutas REST para consulta de telemetría y buffers de señal."""

from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from app.core.constants import CaseId
from app.repositories.telemetry_repository import telemetry_repo
from app.schemas.telemetry import CaseCurrentStatus, CaseTelemetryPayload, TelemetryHistoryRecord
from app.services.telemetry_service import TelemetryService
from app.api.dependencies import get_telemetry_service

router = APIRouter(prefix="/telemetry", tags=["Telemetría"])


@router.get("/status", response_model=List[CaseCurrentStatus])
async def get_all_case_statuses():
    """Retorna el estado instantáneo (presencia, latencia, conectividad) de los 3 casos."""
    return telemetry_repo.get_all_statuses()


@router.get("/{case_id}", response_model=CaseTelemetryPayload)
async def get_case_telemetry(case_id: str):
    """Retorna los puntos de señal recientes y estado para un caso específico."""
    valid_ids = [c.value for c in CaseId]
    if case_id not in valid_ids:
        raise HTTPException(status_code=404, detail=f"Caso '{case_id}' no encontrado. Válidos: {valid_ids}")
    return telemetry_repo.get_payload(case_id)


@router.get("/{case_id}/history", response_model=List[TelemetryHistoryRecord])
async def get_case_persisted_history(case_id: str, limit: int = 50):
    """Retorna el historial de telemetría persistido en SQLite para auditoría y análisis."""
    valid_ids = [c.value for c in CaseId]
    if case_id not in valid_ids:
        raise HTTPException(status_code=404, detail=f"Caso '{case_id}' no encontrado. Válidos: {valid_ids}")
    return await telemetry_repo.get_persisted_history(case_id, limit=limit)


@router.get("/{case_id}/pipeline")
async def get_case_pipeline_info(
    case_id: str,
    telemetry_svc: TelemetryService = Depends(get_telemetry_service),
):
    """Retorna los metadatos y parámetros del pipeline de procesamiento para el caso."""
    if case_id == CaseId.CSI_ROUTER.value:
        return telemetry_svc.router_pipeline.get_filter_metadata()
    elif case_id == CaseId.CSI_DEDICATED.value:
        return telemetry_svc.dedicated_pipeline.get_filter_metadata()
    elif case_id == CaseId.PIR.value:
        return {
            "name": "Trigger Digital Binario",
            "window_size": 1,
            "threshold": 0.5,
            "parameters": {"sampling": "interrupción física por GPIO", "logic": "Active High"},
        }
    else:
        raise HTTPException(status_code=404, detail=f"Caso '{case_id}' no encontrado")


@router.post("/simulation/toggle")
async def toggle_simulation(
    telemetry_svc: TelemetryService = Depends(get_telemetry_service),
):
    """Pausa o reanuda la generación de datos en modo MOCK."""
    if telemetry_svc.is_simulation_paused:
        telemetry_svc.resume_simulation()
    else:
        telemetry_svc.pause_simulation()
    return {"paused": telemetry_svc.is_simulation_paused}


@router.get("/simulation/status")
async def get_simulation_status(
    telemetry_svc: TelemetryService = Depends(get_telemetry_service),
):
    """Retorna si la simulación está actualmente pausada."""
    return {"paused": telemetry_svc.is_simulation_paused}
