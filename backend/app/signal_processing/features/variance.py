"""Extractor de Varianza Temporal para detección de presencia humana en CSI."""

from typing import List
import numpy as np
from app.signal_processing.base import FeatureExtractor


class VarianceFeatureExtractor(FeatureExtractor):
    """
    Calcula la varianza temporal de la amplitud.
    En una habitación estática sin personas, la varianza de CSI es baja y gobernada
    únicamente por ruido térmico de RF.
    La presencia humana o respiración altera los caminos multicamino, elevando sustancialmente
    la varianza de la señal.
    """

    @property
    def name(self) -> str:
        return "Temporal Variance"

    def extract(self, signal: List[float]) -> float:
        if not signal or len(signal) < 2:
            return 0.0
        arr = np.array(signal, dtype=float)
        return float(np.var(arr))
