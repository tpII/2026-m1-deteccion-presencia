from datetime import datetime
import json

from app.repositories.telemetry_repository import TelemetryRepository
from app.signal_processing.presence_detector import CalibrationState, CsiPresenceDetector


class CalibrationTracking:
    def __init__(self, repository: TelemetryRepository):
        self.repository = repository
        self.pending_id: int | None = None
        self.completed_id: int | None = None

    def start(self, event_id: int, now: datetime) -> None:
        if self.pending_id is not None:
            self.repository.enqueue_calibration(
                self.pending_id, now.isoformat(timespec="microseconds"), "interrumpida", None, None, None, None,
            )
        self.pending_id = event_id

    def check_completion(self, detector: CsiPresenceDetector, now: datetime) -> None:
        count = detector.calibration_sample_count
        event_id = self.pending_id
        if event_id is None or detector.state in (CalibrationState.WAITING, CalibrationState.RUNNING):
            return
        self.pending_id = None
        success = detector.calibration_succeeded
        self.repository.enqueue_calibration(
            event_id, now.isoformat(timespec="microseconds"), "exitosa" if success else "fallida",
            json.dumps(detector.reference_profile.tolist()) if success else None,
            detector.movement_threshold if success else None, detector.shape_threshold if success else None, count,
        )
        if success:
            self.completed_id = event_id

    def effective_id(self, detector: CsiPresenceDetector) -> int | None:
        if detector.reference_profile is None:
            self.completed_id = None
        return self.completed_id if detector.state == CalibrationState.READY else None
