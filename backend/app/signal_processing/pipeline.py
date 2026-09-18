"""Pipeline de procesamiento de señal modular para CSI."""

from typing import List, Dict, Any, Tuple
import numpy as np
from app.signal_processing.filters.hampel import HampelFilter
from app.signal_processing.filters.moving_average import MovingAverageFilter
from app.signal_processing.features.variance import VarianceFeatureExtractor
from app.signal_processing.features.amplitude import SignalEnergyExtractor
from app.schemas.telemetry import FilterMetadata, FeatureMetrics


class CsiSignalPipeline:
    """
    Pipeline que ejecuta la cadena de transformación:
    Raw Signal -> Hampel Outlier Removal -> Moving Average -> Feature Extraction -> Threshold Decision.
    Diseñado para ser extensible y permitir la sustitución por algoritmos de Machine Learning
    o descomposición Wavelet / PCA en etapas posteriores.
    """

    def __init__(
        self,
        hampel_window: int = 7,
        hampel_sigmas: float = 3.0,
        ma_window: int = 5,
        variance_threshold: float = 2.2,
    ):
        self.hampel = HampelFilter(window_size=hampel_window, n_sigmas=hampel_sigmas)
        self.moving_average = MovingAverageFilter(window_size=ma_window)
        self.variance_extractor = VarianceFeatureExtractor()
        self.energy_extractor = SignalEnergyExtractor()
        self.variance_threshold = variance_threshold

    def get_filter_metadata(self) -> FilterMetadata:
        """Devuelve los parámetros de los filtros aplicados para la UI."""
        return FilterMetadata(
            name="Hampel + Moving Average",
            window_size=self.hampel.window_size,
            threshold=self.hampel.n_sigmas,
            parameters={
                "hampel_window": self.hampel.window_size,
                "hampel_sigmas": f"{self.hampel.n_sigmas}σ",
                "moving_average_window": self.moving_average.window_size,
                "variance_threshold": self.variance_threshold,
            },
        )

    def process_window(self, raw_signal: List[float]) -> Tuple[List[float], FeatureMetrics, bool]:
        """
        Ejecuta el pipeline completo sobre una ventana de señal temporal.
        Retorna:
            - señal_filtrada (List[float])
            - métricas de características (FeatureMetrics)
            - presencia_detectada (bool)
        """
        if not raw_signal:
            default_features = FeatureMetrics(
                variance=0.0,
                energy=0.0,
                detection_score=0.0,
                threshold_applied=self.variance_threshold,
            )
            return [], default_features, False

        # Etapa 1: Filtro Hampel contra ruidos impulsivos
        hampel_cleaned = self.hampel.apply(raw_signal)

        # Etapa 2: Suavizado por media móvil
        filtered_signal = self.moving_average.apply(hampel_cleaned)

        # Etapa 3: Extracción de características
        # Calculamos varianza sobre los últimos puntos de la ventana filtrada
        window_for_features = filtered_signal[-20:] if len(filtered_signal) >= 20 else filtered_signal
        variance = self.variance_extractor.extract(window_for_features)
        energy = self.energy_extractor.extract(window_for_features)

        # Etapa 4: Función de Score de Detección (Sigmoide normalizada en torno al umbral)
        # Score = 1 / (1 + exp(-k * (var - threshold)))
        k = 1.2
        diff = variance - self.variance_threshold
        detection_score = float(1.0 / (1.0 + np.exp(-k * np.clip(diff, -10.0, 10.0))))

        # Decisión binaria de presencia
        presence_detected = bool(variance >= self.variance_threshold or detection_score >= 0.5)

        features = FeatureMetrics(
            variance=round(variance, 4),
            energy=round(energy, 4),
            detection_score=round(detection_score, 4),
            threshold_applied=self.variance_threshold,
        )

        return filtered_signal, features, presence_detected
