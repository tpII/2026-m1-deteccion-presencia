"""Servicio de cálculo y consolidación de métricas experimentales."""

from typing import List, Optional
from app.repositories.metrics_repository import metrics_repo
from app.schemas.metrics import CaseMetrics, SystemComparison, Trial


class MetricsService:
    """Gestiona la obtención y persistencia de métricas de precisión académica."""

    async def get_case_metrics(self, case_id: str) -> CaseMetrics:
        return await metrics_repo.calculate_case_metrics(case_id)

    async def get_system_comparison(self) -> SystemComparison:
        return await metrics_repo.get_system_comparison()

    async def get_trials(self, case_id: str, limit: int = 50) -> List[Trial]:
        return await metrics_repo.get_trials_by_case(case_id, limit=limit)

    async def record_trial(
        self,
        case_id: str,
        ground_truth: bool,
        detected_presence: bool,
        latency_ms: float,
        score: Optional[float] = None,
        notes: Optional[str] = None,
    ) -> Trial:
        return await metrics_repo.add_trial(
            case_id=case_id,
            ground_truth=ground_truth,
            detected_presence=detected_presence,
            latency_ms=latency_ms,
            score=score,
            notes=notes,
        )


metrics_service = MetricsService()
