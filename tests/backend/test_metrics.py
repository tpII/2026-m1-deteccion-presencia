"""Tests para repositorios y cálculo de métricas experimentales."""

import pytest
from app.database.connection import init_db
from app.repositories.metrics_repository import metrics_repo
from app.core.constants import CaseId


@pytest.mark.asyncio
async def test_metrics_calculation_and_trials():
    # Inicializar esquema
    await init_db()

    # Obtener métricas de PIR
    metrics = await metrics_repo.calculate_case_metrics(CaseId.PIR.value)
    assert metrics.case_id == CaseId.PIR
    assert metrics.total_tests > 0
    assert 0.0 <= metrics.detection_rate <= 100.0

    # Registrar un ensayo controlado
    new_trial = await metrics_repo.add_trial(
        case_id=CaseId.PIR.value,
        ground_truth=True,
        detected_presence=True,
        latency_ms=142.0,
        score=0.95,
        notes="Test unitario",
    )
    assert new_trial.id is not None
    assert new_trial.is_correct is True

    # Verificar que aparece en la lista de ensayos
    trials = await metrics_repo.get_trials_by_case(CaseId.PIR.value, limit=5)
    assert len(trials) > 0
    assert trials[0].id == new_trial.id
