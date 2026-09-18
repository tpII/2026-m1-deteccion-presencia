"""Extractor de energía y amplitud media para señales CSI."""

from typing import List
import numpy as np
from app.signal_processing.base import FeatureExtractor


class SignalEnergyExtractor(FeatureExtractor):
    """Calcula la energía promedio de la señal en la ventana actual."""

    @property
    def name(self) -> str:
        return "Signal Energy"

    def extract(self, signal: List[float]) -> float:
        if not signal:
            return 0.0
        arr = np.array(signal, dtype=float)
        # Energía cuadrática media normalizada
        energy = np.mean(arr ** 2)
        return float(energy)
