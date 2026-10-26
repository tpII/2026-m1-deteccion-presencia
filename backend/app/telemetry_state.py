from collections import deque
from datetime import datetime, timezone
from typing import Literal

from app.constants import (CASE_NAMES, CONNECTION_TIMEOUT_SECONDS, DISPLAY_POINTS, INDICATOR_DISPLAY_POINTS,
                           MAX_SERIES_POINTS, CaseId)
from app.schemas.telemetry import CalibrationInfo, CaseCurrentStatus, CaseTelemetryPayload, FeatureMetrics, SignalPoint


class TelemetryState:
    def __init__(self, max_points: int = MAX_SERIES_POINTS):
        self._raw: dict[str, deque[SignalPoint]] = {
            case: deque(maxlen=max_points) for case in CaseId
        }
        # Indicadores del detector CSI (no existen para el PIR)
        self._movement: dict[str, deque[SignalPoint]] = {
            case: deque(maxlen=max_points) for case in CaseId if case != CaseId.PIR
        }
        self._shape: dict[str, deque[SignalPoint]] = {
            case: deque(maxlen=max_points) for case in CaseId if case != CaseId.PIR
        }
        self._statuses = {
            case: CaseCurrentStatus(
                case_id=case,
                name=name,
                is_connected=False,
                presence=False,
                current_latency_ms=0,
                last_updated=datetime.now(timezone.utc).isoformat(),
                total_samples=0,
            )
            for case, name in CASE_NAMES.items()
        }
        self._features: dict[str, FeatureMetrics] = {}
        self._calibration: dict[str, CalibrationInfo] = {}

    def append_raw_point(self, case_id: str, point: SignalPoint) -> None:
        self._raw[case_id].append(point)

    def append_indicator_points(self, case_id: str, timestamp: float, features: FeatureMetrics) -> None:
        if features.movement_index is not None:
            self._movement[case_id].append(SignalPoint(timestamp=timestamp, value=features.movement_index))
        if features.shape_index is not None:
            self._shape[case_id].append(SignalPoint(timestamp=timestamp, value=features.shape_index))

    def set_calibration(self, case_id: str, calibration: CalibrationInfo) -> None:
        self._calibration[case_id] = calibration

    def get_raw_points(self, case_id: str) -> list[SignalPoint]:
        return list(self._raw[case_id])

    def update_case_state(
        self,
        case_id: str,
        presence: bool,
        latency_ms: float,
        features: FeatureMetrics | None = None,
    ) -> None:
        status = self._statuses[case_id]
        status.presence = presence
        status.current_latency_ms = round(latency_ms, 1)
        status.last_updated = datetime.now(timezone.utc).isoformat()
        status.total_samples += 1
        status.is_connected = True
        status.target_type = "person_active" if presence else "empty"
        if features is not None:
            self._features[case_id] = features

    def get_all_statuses(self) -> list[CaseCurrentStatus]:
        now = datetime.now(timezone.utc)
        for status in self._statuses.values():
            age = (now - datetime.fromisoformat(status.last_updated)).total_seconds()
            status.is_connected = status.total_samples > 0 and age < CONNECTION_TIMEOUT_SECONDS
        return list(self._statuses.values())

    def get_payload(self, case_id: str) -> CaseTelemetryPayload:
        status = self._statuses[case_id]
        features = self._features.get(case_id)
        return CaseTelemetryPayload(
            case_id=case_id,
            presence=status.presence,
            latency_ms=status.current_latency_ms,
            raw_points=list(self._raw[case_id])[-DISPLAY_POINTS:],
            movement_points=list(self._movement[case_id])[-INDICATOR_DISPLAY_POINTS:] if case_id in self._movement else None,
            shape_points=list(self._shape[case_id])[-INDICATOR_DISPLAY_POINTS:] if case_id in self._shape else None,
            features=features,
            calibration=self._calibration.get(case_id),
            target_type=status.target_type or "empty",
        )

    def get_message(self, message_type: Literal["initial_state", "telemetry_batch"]) -> dict:
        return {
            "type": message_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": {
                "statuses": [status.model_dump() for status in self.get_all_statuses()],
                "cases": {case.value: self.get_payload(case).model_dump() for case in CaseId},
            },
        }


telemetry_state = TelemetryState()
