from datetime import datetime
import json

from app.repositories.telemetry_repository import TelemetryRepository
from app.signal_processing.presence_detector import CalibrationState, CsiPresenceDetector


class CalibrationTracking:
    def __init__(self, repository: TelemetryRepository):
        self.repository = repository
        self.pending: dict[str, int] = {}
        self.completed: dict[str, int] = {}

    def start(self, case_id: str, event_id: int, now: datetime) -> None:
        previous = self.pending.get(case_id)
        if previous is not None:
            self.repository.enqueue_calibration(
                previous, now.isoformat(timespec="microseconds"), "interrumpida", None, None, None, None,
            )
        self.pending[case_id] = event_id

    def check_completion(self, case_id: str, detector: CsiPresenceDetector, now: datetime) -> None:
        count = detector.calibration_sample_count
        event_id = self.pending.get(case_id)
        if event_id is None or detector.state in (CalibrationState.WAITING, CalibrationState.RUNNING):
            return
        self.pending.pop(case_id)
        success = detector.calibration_succeeded
        self.repository.enqueue_calibration(
            event_id, now.isoformat(timespec="microseconds"), "exitosa" if success else "fallida",
            json.dumps(detector.reference_profile.tolist()) if success else None,
            detector.movement_threshold if success else None, detector.shape_threshold if success else None, count,
        )
        if success:
            self.completed[case_id] = event_id

    def effective_id(self, case_id: str, detector: CsiPresenceDetector) -> int | None:
        if detector.reference_profile is None:
            self.completed.pop(case_id, None)
        return self.completed.get(case_id) if detector.state == CalibrationState.READY else None
