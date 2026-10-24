from datetime import datetime, timezone
from app.database import get_db_connection
from app.constants import CASE_NAMES, CaseId
from app.schemas.metrics import CaseMetrics, Trial, ComparisonTableEntry, SystemComparison


class MetricsRepository:
    async def get_trials_by_case(self, case_id: str, limit: int = 50) -> list[Trial]:
        async with get_db_connection() as db:
            cursor = await db.execute(
                """
                SELECT id, case_id, timestamp, ground_truth, detected_presence, is_correct, latency_ms, score, notes
                FROM trials
                WHERE case_id = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (case_id, limit),
            )
            rows = await cursor.fetchall()
            return [Trial(**dict(row)) for row in rows]

    async def add_trial(
        self,
        case_id: str,
        ground_truth: bool,
        detected_presence: bool,
        latency_ms: float,
        score: float | None = None,
        notes: str | None = None,
    ) -> Trial:
        is_correct = int(ground_truth == detected_presence)
        now_iso = datetime.now(timezone.utc).isoformat()

        async with get_db_connection() as db:
            cursor = await db.execute(
                """
                INSERT INTO trials (case_id, timestamp, ground_truth, detected_presence, is_correct, latency_ms, score, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    case_id,
                    now_iso,
                    int(ground_truth),
                    int(detected_presence),
                    is_correct,
                    latency_ms,
                    score,
                    notes,
                ),
            )
            await db.commit()
            trial_id = cursor.lastrowid

            return Trial(
                id=trial_id,
                case_id=CaseId(case_id),
                timestamp=now_iso,
                ground_truth=ground_truth,
                detected_presence=detected_presence,
                is_correct=bool(is_correct),
                latency_ms=latency_ms,
                score=score,
                notes=notes,
            )

    async def calculate_case_metrics(self, case_id: str) -> CaseMetrics:
        async with get_db_connection() as db:
            cursor = await db.execute(
                """
                SELECT
                    COUNT(*) as total,
                    SUM(is_correct) as correct,
                    SUM(CASE WHEN ground_truth = 0 AND detected_presence = 1 THEN 1 ELSE 0 END) as false_positives,
                    SUM(CASE WHEN ground_truth = 1 AND detected_presence = 0 THEN 1 ELSE 0 END) as false_negatives,
                    SUM(CASE WHEN ground_truth = 1 AND detected_presence = 1 THEN 1 ELSE 0 END) as true_positives,
                    AVG(latency_ms) as avg_latency
                FROM trials
                WHERE case_id = ?
                """,
                (case_id,),
            )
            row = await cursor.fetchone()

            total = row["total"] or 0
            correct = row["correct"] or 0
            false_positives = row["false_positives"] or 0
            false_negatives = row["false_negatives"] or 0
            true_positives = row["true_positives"] or 0
            avg_latency = row["avg_latency"] or 0.0

            positive_predictions = true_positives + false_positives
            actual_positives = true_positives + false_negatives
            f1_denominator = 2 * true_positives + false_positives + false_negatives

            return CaseMetrics(
                case_id=case_id,
                case_name=CASE_NAMES[case_id],
                total_tests=total,
                correct_detections=correct,
                detection_rate=round(correct / total * 100, 1) if total else 0,
                false_positives=false_positives,
                false_negatives=false_negatives,
                average_latency_ms=round(avg_latency, 1),
                precision=round(true_positives / positive_predictions, 3) if positive_predictions else None,
                recall=round(true_positives / actual_positives, 3) if actual_positives else None,
                f1_score=round(2 * true_positives / f1_denominator, 3) if f1_denominator else None,
            )

    async def get_system_comparison(self) -> SystemComparison:
        metrics = [await self.calculate_case_metrics(case) for case in CaseId]
        rows = [
            ("Tasa de detección", "%", "detection_rate"),
            ("Falsos positivos", "ensayos", "false_positives"),
            ("Falsos negativos", "ensayos", "false_negatives"),
            ("Latencia media", "ms", "average_latency_ms"),
            ("Ensayos evaluados", "cant.", "total_tests"),
        ]
        table = []
        for label, unit, field in rows:
            values = {}
            for case_metrics in metrics:
                value = getattr(case_metrics, field)
                if unit in ("%", "ms"):
                    value = f"{value} {unit}" if case_metrics.total_tests else "Sin ensayos"
                values[case_metrics.case_id.value] = value
            table.append(ComparisonTableEntry(metric=label, unit=unit, **values))

        return SystemComparison(
            metrics=metrics,
            table=table,
            last_updated=datetime.now(timezone.utc).isoformat(),
        )


metrics_repo = MetricsRepository()
