"""Filtro de Media Móvil (Moving Average)."""

from typing import List, Dict, Any
import numpy as np
from app.signal_processing.base import SignalFilter


class MovingAverageFilter(SignalFilter):
    """Filtro de media móvil para suavizado de fluctuaciones de alta frecuencia."""

    def __init__(self, window_size: int = 5):
        if window_size < 1:
            raise ValueError("El tamaño de ventana debe ser mayor o igual a 1")
        self.window_size = window_size

    @property
    def name(self) -> str:
        return "Moving Average"

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "window_size": self.window_size,
            "kernel_type": "uniform",
        }

    def apply(self, signal: List[float]) -> List[float]:
        if not signal:
            return []
        if len(signal) < self.window_size:
            return list(signal)

        arr = np.array(signal, dtype=float)
        k = self.window_size // 2
        pad_left = k
        pad_right = self.window_size - 1 - k
        padded = np.pad(arr, (pad_left, pad_right), mode="edge")
        kernel = np.ones(self.window_size) / self.window_size
        filtered = np.convolve(padded, kernel, mode="valid")
        return [float(x) for x in filtered]
