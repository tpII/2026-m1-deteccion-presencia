"""Filtro Pasa-Bajos (Low-Pass Filter) para atenuación de ruido de alta frecuencia."""

from typing import List, Dict, Any
import numpy as np
from scipy import signal as sp_signal
from app.signal_processing.base import SignalFilter


class LowPassFilter(SignalFilter):
    """Filtro Butterworth Pasa-Bajos de segundo orden."""

    def __init__(self, cutoff_hz: float = 2.0, fs_hz: float = 10.0, order: int = 2):
        self.cutoff_hz = cutoff_hz
        self.fs_hz = fs_hz
        self.order = order

        # Frecuencia de Nyquist y frecuencia crítica normalizada (Wn)
        nyq = 0.5 * fs_hz
        normal_cutoff = min(cutoff_hz / nyq, 0.99)
        self.b, self.a = sp_signal.butter(order, normal_cutoff, btype="low", analog=False)

    @property
    def name(self) -> str:
        return "Butterworth Low-Pass"

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "order": self.order,
            "cutoff_hz": f"{self.cutoff_hz} Hz",
            "sampling_rate_hz": f"{self.fs_hz} Hz",
        }

    def apply(self, signal: List[float]) -> List[float]:
        # Requiere un mínimo de puntos para filtfilt
        min_len = 3 * (max(len(self.a), len(self.b)) - 1)
        if len(signal) <= min_len:
            return list(signal)

        arr = np.array(signal, dtype=float)
        try:
            filtered = sp_signal.filtfilt(self.b, self.a, arr)
            return [float(x) for x in filtered]
        except Exception:
            return list(signal)
