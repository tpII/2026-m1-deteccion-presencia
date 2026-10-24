"""Tests para filtros y pipeline de procesamiento de señal."""

import numpy as np
from app.signal_processing.filters import MovingAverageFilter
from app.signal_processing.filters import HampelFilter
from app.signal_processing.pipeline import CsiSignalPipeline


def test_moving_average_filter():
    ma = MovingAverageFilter(window_size=3)
    signal = [10.0, 10.0, 10.0, 10.0, 10.0]
    filtered = ma.apply(signal)
    assert len(filtered) == len(signal)
    assert abs(filtered[2] - 10.0) < 1e-3


def test_hampel_filter_outlier_rejection():
    hampel = HampelFilter(window_size=5, n_sigmas=3.0)
    # Señal plana con un outlier masivo en el centro
    signal = [20.0, 20.0, 20.0, 80.0, 20.0, 20.0, 20.0]
    filtered = hampel.apply(signal)
    # El valor 80.0 debe haber sido sustituido por la mediana (20.0)
    assert filtered[3] == 20.0


def test_csi_signal_pipeline_presence():
    pipeline = CsiSignalPipeline(hampel_window=5, ma_window=3, variance_threshold=2.0)

    # 1. Señal sin presencia (baja varianza constante)
    quiet_signal = [20.0 + (i % 2) * 0.1 for i in range(30)]
    _, features_quiet, presence_quiet = pipeline.process_window(quiet_signal)
    assert features_quiet.variance < 2.0
    assert presence_quiet is False

    # 2. Señal con presencia (alta perturbación y varianza)
    disturbed_signal = [20.0 + (5.0 if i % 2 == 0 else -5.0) for i in range(30)]
    _, features_disturbed, presence_disturbed = pipeline.process_window(disturbed_signal)
    assert features_disturbed.variance > 2.0
    assert presence_disturbed is True


def test_csi_target_discrimination():
    pipeline = CsiSignalPipeline(hampel_window=5, ma_window=3, variance_threshold=2.0)

    # 1. Objeto periódico estricto (ventilador rotando): onda sinusoidal armónica pura
    t = np.linspace(0, 2 * np.pi * 5, 40)
    fan_signal = list(22.0 + np.sin(t) * 4.0)
    _, features_fan, _ = pipeline.process_window(fan_signal)
    assert features_fan.periodicity_ratio >= 0.40
    assert features_fan.target_type == "object_fan"

    # 2. Ambiente vacío
    empty_signal = [22.0 + np.random.normal(0, 0.1) for _ in range(30)]
    _, features_empty, presence_empty = pipeline.process_window(empty_signal)
    assert features_empty.target_type == "empty"
    assert presence_empty is False
