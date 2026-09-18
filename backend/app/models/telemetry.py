"""Entidades de persistencia y modelos de datos relacionales."""

from dataclasses import dataclass
from typing import Optional


@dataclass
class TelemetryRecord:
    id: Optional[int]
    case_id: str
    timestamp: str
    presence: int
    raw_value: float
    latency_ms: float


@dataclass
class TrialRecord:
    id: Optional[int]
    case_id: str
    timestamp: str
    ground_truth: int
    detected_presence: int
    is_correct: int
    latency_ms: float
    score: Optional[float]
    notes: Optional[str]


@dataclass
class ExperimentRecord:
    id: Optional[int]
    name: str
    case_id: str
    started_at: str
    ended_at: Optional[str]
    environment: Optional[str]
    notes: Optional[str]
