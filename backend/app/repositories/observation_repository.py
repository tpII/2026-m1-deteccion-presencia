from datetime import datetime, timezone

from app.database import get_db_connection
from app.schemas.observations import CalibrationCounts, EvaluatedSample, Observation, ObservationInput, ObservationReport

async def record_observation(request: ObservationInput, run_id: str) -> Observation:
    received_at = datetime.now(timezone.utc).isoformat(timespec="microseconds")
    observed_at = request.observed_at.astimezone(timezone.utc).isoformat(timespec="microseconds")
    async with get_db_connection() as db:
        cursor = await db.execute("""
            INSERT INTO observations (case_id, environment, scenario, observed_at, received_at, run_id)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (request.case_id, request.environment, request.scenario, observed_at, received_at, run_id))
        await db.commit()
        return Observation(
            id=cursor.lastrowid, case_id=request.case_id, environment=request.environment,
            scenario=request.scenario, observed_at=observed_at, received_at=received_at,
        )


async def get_report(case_id: str, environment: str) -> ObservationReport:
    async with get_db_connection() as db:
        async with db.execute("""
            SELECT id, case_id, environment, scenario, observed_at, received_at FROM observations
            WHERE case_id = ? AND environment = ? ORDER BY observed_at DESC, id DESC LIMIT 10
        """, (case_id, environment)) as cursor:
            marks = [Observation(**dict(row)) for row in await cursor.fetchall()]

        async with db.execute("SELECT MIN(observed_at) FROM observations WHERE case_id = ? AND environment = ?",
                              (case_id, environment)) as cursor:
            earliest = (await cursor.fetchone())[0]
        samples = []
        if earliest is not None:
            async with db.execute("""
                SELECT id, timestamp, detected_presence, observation_id, scenario, result
                FROM evaluated_samples
                WHERE case_id = ? AND timestamp >= ? AND environment = ?
                ORDER BY timestamp DESC, id DESC LIMIT 20
            """, (case_id, earliest, environment)) as cursor:
                samples = [EvaluatedSample(**dict(row)) for row in await cursor.fetchall()]

        async with db.execute("""
            WITH periods AS (
                SELECT id, started_at, finished_at, outcome, sample_count FROM csi_calibration_events
                WHERE case_id = 'csi_router' AND environment = ? AND outcome IS NOT NULL
                ORDER BY started_at DESC, id DESC LIMIT 20
            ), counts AS (
                SELECT sample.calibration_id, COUNT(*) AS evaluated,
                       SUM(sample.result = 'false_positive') AS false_positives,
                       SUM(sample.result = 'false_negative') AS false_negatives
                FROM periods
                JOIN evaluated_samples AS sample ON sample.calibration_id = periods.id
                WHERE sample.case_id = ? AND sample.environment = ?
                GROUP BY sample.calibration_id
            )
            SELECT periods.*,
                   COALESCE(counts.evaluated, 0) AS evaluated,
                   COALESCE(counts.false_positives, 0) AS false_positives,
                   COALESCE(counts.false_negatives, 0) AS false_negatives
            FROM periods LEFT JOIN counts ON counts.calibration_id = periods.id
            ORDER BY periods.started_at DESC, periods.id DESC
        """, (environment, case_id, environment)) as cursor:
            calibrations = [CalibrationCounts(**dict(row)) for row in await cursor.fetchall()]
    return ObservationReport(marks=marks, samples=samples, calibrations=calibrations)
