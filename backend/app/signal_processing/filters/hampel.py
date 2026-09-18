"""Filtro de Hampel para eliminación de outliers impulsivos en CSI."""

from typing import List, Dict, Any
import numpy as np
from app.signal_processing.base import SignalFilter


class HampelFilter(SignalFilter):
    """
    Filtro de Hampel basado en la Desviación Absoluta de la Mediana (MAD).
    Reemplaza outliers impulsivos por el valor local de la mediana.
    Muy utilizado en la literatura de Wi-Fi CSI para depurar ruidos de canal.
    """

    def __init__(self, window_size: int = 7, n_sigmas: float = 3.0):
        if window_size % 2 == 0:
            window_size += 1  # Forzar ventana impar centrada
        self.window_size = window_size
        self.n_sigmas = n_sigmas

    @property
    def name(self) -> str:
        return "Hampel Filter"

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "window_size": self.window_size,
            "n_sigmas": f"{self.n_sigmas}σ",
            "method": "Median Absolute Deviation (MAD)",
        }

    def apply(self, signal: List[float]) -> List[float]:
        n = len(signal)
        if n < self.window_size:
            return list(signal)

        arr = np.array(signal, dtype=float)
        filtered = arr.copy()
        k = self.window_size // 2

        # Factor de escala para estimador insesgado de desviación estándar normal
        scale_factor = 1.4826

        for i in range(k, n - k):
            window = arr[i - k : i + k + 1]
            median = np.median(window)
            mad = np.median(np.abs(window - median))
            threshold = self.n_sigmas * scale_factor * mad

            if np.abs(arr[i] - median) > threshold:
                filtered[i] = median

        return [float(x) for x in filtered]
