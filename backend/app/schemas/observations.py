from typing import Literal, Self

from pydantic import AwareDatetime, BaseModel, model_validator

from app.schemas.metrics import Environment, TrialScenario

MeasuredCase = Literal["pir", "csi_router"]


class ObservationInput(BaseModel):
    case_id: MeasuredCase
    environment: Environment
    scenario: TrialScenario | None
    observed_at: AwareDatetime

    @model_validator(mode="after")
    def validate_scenario(self) -> Self:
        if self.case_id == "pir" and self.scenario not in (None, "present", "absent"):
            raise ValueError("El PIR admite presencia o ausencia observada")
        return self


class Observation(BaseModel):
    id: int
    case_id: MeasuredCase
    environment: str
    scenario: TrialScenario | None
    observed_at: str
    received_at: str


class EvaluatedSample(BaseModel):
    id: int
    timestamp: str
    detected_presence: bool
    observation_id: int
    scenario: TrialScenario
    result: Literal["correct", "false_positive", "false_negative"]


class CalibrationCounts(BaseModel):
    id: int
    started_at: str
    finished_at: str | None = None
    outcome: str
    sample_count: int | None = None
    evaluated: int = 0
    false_positives: int = 0
    false_negatives: int = 0


class ObservationReport(BaseModel):
    marks: list[Observation]
    samples: list[EvaluatedSample]
    calibrations: list[CalibrationCounts]
