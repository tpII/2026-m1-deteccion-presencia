"""Tests de serialización y validación de esquemas Pydantic."""

from app.core.constants import CaseId
from app.schemas.telemetry import TelemetrySample, CsiRawSample, SignalPoint
from app.schemas.metrics import ComparisonTableEntry


def test_telemetry_sample_schema():
    sample = TelemetrySample(
        case_id=CaseId.PIR,
        source="esp32_test",
        presence=True,
        raw_value=1.0,
        latency_ms=145.0,
    )
    assert sample.case_id == CaseId.PIR
    assert sample.presence is True
    dumped = sample.model_dump()
    assert dumped["case_id"] == "pir"
    assert "timestamp" in dumped


def test_csi_raw_sample_schema():
    sample = CsiRawSample(
        case_id=CaseId.CSI_ROUTER,
        amplitudes=[20.5, 21.0, 19.8],
        latency_ms=315.0,
    )
    assert len(sample.amplitudes) == 3
    assert sample.case_id == CaseId.CSI_ROUTER


def test_comparison_table_entry():
    entry = ComparisonTableEntry(
        metric="Tasa de detección",
        unit="%",
        pir="97 %",
        csi_router="94 %",
        csi_dedicated="91 %",
    )
    assert entry.metric == "Tasa de detección"
    assert entry.pir == "97 %"
