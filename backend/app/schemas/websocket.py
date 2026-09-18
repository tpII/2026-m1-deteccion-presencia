"""Esquemas de mensajes para el canal WebSocket /ws/telemetry."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.schemas.telemetry import CaseCurrentStatus, SignalPoint, FilterMetadata, FeatureMetrics


class WebSocketMessage(BaseModel):
    """Mensaje base emitido por el WebSocket."""
    type: str = Field(..., description="Tipo de evento: 'initial_state', 'telemetry_batch', 'heartbeat'")
    timestamp: str
    data: Dict[str, Any]


class CaseTelemetryPayload(BaseModel):
    """Carga de telemetría en tiempo real por caso."""
    case_id: str
    presence: bool
    latency_ms: float
    raw_points: List[SignalPoint]
    filtered_points: Optional[List[SignalPoint]] = None
    filter_metadata: Optional[FilterMetadata] = None
    features: Optional[FeatureMetrics] = None
    current_score: Optional[float] = None
    ground_truth: Optional[bool] = None


class BatchUpdatePayload(BaseModel):
    """Lote de actualización periódico enviado a los clientes conectados."""
    statuses: List[CaseCurrentStatus]
    cases: Dict[str, CaseTelemetryPayload]
