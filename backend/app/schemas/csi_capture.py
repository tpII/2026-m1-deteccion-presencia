from typing import Literal

from pydantic import BaseModel

from app.schemas.metrics import Environment

CsiActivity = Literal["empty", "walking", "seated"]


class StartCsiCapture(BaseModel):
    environment: Environment
    activity: CsiActivity


class CsiCapture(BaseModel):
    id: int
    environment: str
    activity: CsiActivity
    starts_at: str
    ends_at: str


class CsiHeatmapColumn(BaseModel):
    index: int
    relative_amplitudes: list[float]


class CsiHeatmap(BaseModel):
    capture: CsiCapture
    step_seconds: float
    column_count: int
    columns: list[CsiHeatmapColumn]


class CsiCaptureComparison(BaseModel):
    as_of: str
    active_capture: CsiCapture | None
    heatmaps: list[CsiHeatmap]


class CsiCapturePreview(BaseModel):
    active: bool
    heatmap: CsiHeatmap
