"""Comprobaciones del cálculo: bases vacías y ensayos registrados sin valores de ejemplo."""

import pytest
from app.database.connection import init_db
from app.repositories.metrics_repository import metrics_repo
from app.core.constants import CaseId


@pytest.mark.asyncio
async def test_empty_database_has_no_seeded_trials_or_metrics():
    await init_db()
    await init_db()
    for case in CaseId:
        assert await metrics_repo.get_trials_by_case(case.value) == []
        metrics = await metrics_repo.calculate_case_metrics(case.value)
        assert metrics.total_tests == 0
        assert metrics.correct_detections == 0
        assert metrics.detection_rate == 0
        assert metrics.false_positives == metrics.false_negatives == 0
        assert metrics.average_latency_ms == 0
        assert metrics.precision is None
        assert metrics.recall is None


@pytest.mark.asyncio
async def test_metrics_use_only_registered_trials_even_with_fewer_than_five():
    await init_db()
    for ground_truth, detected_presence, latency in [(True, True, 100), (False, True, 200), (True, False, 300)]:
        await metrics_repo.add_trial(
            case_id="pir", ground_truth=ground_truth, detected_presence=detected_presence,
            latency_ms=latency, notes="Fixture de comprobación en base temporal",
        )
    metrics = await metrics_repo.calculate_case_metrics("pir")
    assert metrics.total_tests == 3
    assert metrics.correct_detections == 1
    assert metrics.detection_rate == 33.3
    assert metrics.false_positives == 1
    assert metrics.false_negatives == 1
    assert metrics.average_latency_ms == 200
    assert metrics.precision == metrics.recall == metrics.f1_score == 0.5
    assert len(await metrics_repo.get_trials_by_case("pir")) == 3
    assert (await metrics_repo.calculate_case_metrics("csi_router")).total_tests == 0
