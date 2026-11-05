"""Indicadores, ventanas temporales y umbrales del detector CSI."""

from collections import deque

import numpy as np

WINDOW_SECONDS = 4.0
MIN_WINDOW_SAMPLES = 5
THRESHOLD_SIGMAS = 3.0
MIN_THRESHOLD_RATIO = 1.3


def turbulence(amplitudes: np.ndarray) -> float:
    mean = float(amplitudes.mean())
    return float(amplitudes.std() / mean) if mean > 0 else 0.0


def profile(amplitudes: np.ndarray) -> np.ndarray:
    mean = float(amplitudes.mean())
    return amplitudes / mean if mean > 0 else np.zeros_like(amplitudes)


def shape_distance(amplitudes: np.ndarray, reference_profile: np.ndarray) -> float:
    return float(np.sqrt(np.mean((profile(amplitudes) - reference_profile) ** 2)))


class TimeWindow:
    """Valores de los últimos `seconds` segundos."""

    def __init__(self, seconds: float = WINDOW_SECONDS):
        self.seconds = seconds
        self._items: deque[tuple[float, float]] = deque()

    def add(self, now: float, value: float) -> None:
        self._items.append((now, value))
        while self._items and self._items[0][0] < now - self.seconds:
            self._items.popleft()

    def clear(self) -> None:
        self._items.clear()

    def _values(self) -> np.ndarray | None:
        if len(self._items) < MIN_WINDOW_SAMPLES:
            return None
        return np.array([value for _, value in self._items])

    def std(self) -> float | None:
        values = self._values()
        return float(values.std()) if values is not None else None

    def mean(self) -> float | None:
        values = self._values()
        return float(values.mean()) if values is not None else None


def threshold_from(values: list[float]) -> float:
    """Umbral = promedio + THRESHOLD_SIGMAS desvíos de la línea base.

    Las ventanas se superponen, así que pocos segundos de calibración pueden subestimar el desvío.
    Por eso el umbral tiene un mínimo relativo al promedio.
    """
    baseline = np.array(values)
    mean = float(baseline.mean())
    return max(mean + THRESHOLD_SIGMAS * float(baseline.std()), MIN_THRESHOLD_RATIO * mean)
