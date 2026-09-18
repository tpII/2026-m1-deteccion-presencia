"""Tests para filtros y pipeline de procesamiento de señal."""

import numpy as np
from app.signal_processing.filters.moving_average import MovingAverageFilter
from app.signal_processing.filters.hampel import HampelFilter
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
