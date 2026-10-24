"""Comprobaciones del cálculo: bases vacías y ensayos registrados sin valores de ejemplo."""

import pytest
from httpx import ASGITransport, AsyncClient
from app.database import init_db
from app.main import app
from app.repositories.metrics_repository import metrics_repo
from app.constants import CaseId


@pytest.mark.parametrize("observed, detected", [(True, False), (False, True)])
async def test_f1_is_zero_when_all_predictions_are_wrong(observed, detected):
    await init_db()
    await metrics_repo.add_trial("pir", observed, detected, 0)
    metrics = await metrics_repo.calculate_case_metrics("pir")
    assert metrics.f1_score == 0


async def test_f1_uses_unrounded_counts():
    await init_db()
    for observed, detected in [(True, True)] * 2 + [(True, False)] * 5:
        await metrics_repo.add_trial("pir", observed, detected, 0)
    metrics = await metrics_repo.calculate_case_metrics("pir")
    assert metrics.f1_score == 0.444


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


@pytest.mark.asyncio
async def test_trial_api_updates_history_metrics_and_comparison():
    """Recorre las rutas que usa el formulario después de retirar la capa de servicio."""
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for observed, detected in [(True, True), (False, True)]:
            response = await client.post("/api/v1/metrics/trial", json={
                "case_id": "pir",
                "ground_truth": observed,
                "detected_presence": detected,
                "latency_ms": 100,
                "notes": "Ensayo de prueba en base temporal",
            })
            assert response.status_code == 200
            assert response.json()["is_correct"] == (observed == detected)

        history = await client.get("/api/v1/metrics/pir/trials")
        assert history.status_code == 200
        assert len(history.json()) == 2

        metrics = await client.get("/api/v1/metrics/pir")
        assert metrics.status_code == 200
        assert metrics.json()["detection_rate"] == 50
        assert metrics.json()["false_positives"] == 1

        comparison = await client.get("/api/v1/metrics/comparison")
        assert comparison.status_code == 200
        by_case = {row["case_id"]: row for row in comparison.json()["metrics"]}
        assert by_case["pir"]["total_tests"] == 2
        assert by_case["csi_router"]["total_tests"] == 0
        assert by_case["csi_dedicated"]["total_tests"] == 0
