"""Comprobaciones del cálculo: bases vacías y ensayos registrados sin valores de ejemplo."""

import pytest
from httpx import ASGITransport, AsyncClient
from app.database import get_db_connection, init_db
from app.main import app
from app.repositories.metrics_repository import metrics_repo
from app.constants import CaseId


async def test_migration_preserves_old_trials_and_usb_readings():
    async with get_db_connection() as db:
        await db.execute("""
            CREATE TABLE trials (
                id INTEGER PRIMARY KEY AUTOINCREMENT, case_id TEXT, timestamp TEXT,
                ground_truth INTEGER, detected_presence INTEGER, is_correct INTEGER,
                latency_ms REAL, score REAL, notes TEXT
            )
        """)
        await db.execute("INSERT INTO trials VALUES (1, 'pir', '2026-01-01', 1, 1, 1, 90, NULL, 'Anterior')")
        await db.execute("INSERT INTO trials VALUES (2, 'csi_dedicated', '2026-01-01', 1, 1, 1, 90, NULL, 'Histórico')")
        await db.execute("""
            CREATE TABLE pir_usb_readings (id INTEGER PRIMARY KEY, received_at TEXT, motion INTEGER)
        """)
        await db.execute("INSERT INTO pir_usb_readings VALUES (1, '2026-01-01T12:00:00+00:00', 1)")
        await db.commit()
    await init_db()
    await init_db()
    [trial] = await metrics_repo.get_trials_by_case("pir")
    assert trial.notes == "Anterior"
    assert trial.environment is None
    assert trial.scenario is None
    comparison = await metrics_repo.get_system_comparison()
    assert {metric.case_id for metric in comparison.metrics} == {"pir", "csi_router"}
    async with get_db_connection() as db:
        async with db.execute("SELECT motion FROM pir_usb_readings WHERE id = 1") as cursor:
            assert (await cursor.fetchone())["motion"] == 1
        async with db.execute("SELECT case_id FROM trials WHERE id = 2") as cursor:
            assert (await cursor.fetchone())["case_id"] == "csi_dedicated"


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
