"""Detección de presencia por CSI con dos indicadores y calibración en el lugar.

Cada paquete CSI llega como una lista de amplitudes |H(k)|, una por subportadora.
Con ellas se calculan dos indicadores sobre una ventana móvil de WINDOW_SECONDS:

1. Movimiento: cuánto fluctúa el canal.
   turbulencia = desvío / promedio de las amplitudes del paquete
   indicador   = desvío de la turbulencia dentro de la ventana
   Sube mucho cuando alguien camina.

2. Forma: cuánto se aleja el canal de como era con la habitación vacía.
   perfil    = amplitudes / promedio del paquete (quita el ajuste automático de ganancia del chip)
   distancia = valor RMS de (perfil - perfil de la calibración)
   indicador = promedio de la distancia dentro de la ventana
   Detecta también a una persona quieta, porque su cuerpo cambia los caminos de la señal.

Calibración: con la habitación vacía se registran CALIBRATION_SECONDS de paquetes. De ahí salen
el perfil de referencia y un umbral por indicador: promedio + THRESHOLD_SIGMAS desvíos
(con un mínimo de MIN_THRESHOLD_RATIO veces el promedio).
Hay presencia cuando cualquiera de los dos indicadores supera su umbral.

El algoritmo y sus parámetros se validaron fuera de línea con grabaciones reales
(ver prueba_CSI/analisis).
"""

from collections import deque
from dataclasses import dataclass
from enum import Enum

import numpy as np

WINDOW_SECONDS = 4.0
MIN_WINDOW_SAMPLES = 5
THRESHOLD_SIGMAS = 3.0
MIN_THRESHOLD_RATIO = 1.3  # el umbral nunca queda por debajo de 1,3 x el promedio de la línea base
CALIBRATION_DELAY_SECONDS = 10.0
CALIBRATION_SECONDS = 30.0
MIN_CALIBRATION_SAMPLES = 50


class CalibrationState(str, Enum):
    NOT_CALIBRATED = "sin_calibrar"
    WAITING = "esperando"        # cuenta regresiva para que la persona salga de la habitación
    RUNNING = "calibrando"       # registrando la habitación vacía
    READY = "calibrado"


@dataclass
class DetectionResult:
    mean_amplitude: float
    movement_index: float | None
    shape_index: float | None
    presence: bool
    detection_ratio: float  # indicador / umbral del más alto de los dos; >= 1 significa presencia


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


class CsiPresenceDetector:
    def __init__(self):
        self.state = CalibrationState.NOT_CALIBRATED
        self.message = "Calibrá con la habitación vacía para empezar a detectar."
        self.reference_profile: np.ndarray | None = None
        self.movement_threshold: float | None = None
        self.shape_threshold: float | None = None
        self._movement_window = TimeWindow()
        self._shape_window = TimeWindow()
        self._calibration_start = 0.0
        self._calibration_end = 0.0
        self._calibration_samples: list[tuple[float, np.ndarray]] = []

    # --- Calibración ---------------------------------------------------------------------------

    def start_calibration(
        self,
        now: float,
        delay_seconds: float = CALIBRATION_DELAY_SECONDS,
        duration_seconds: float = CALIBRATION_SECONDS,
    ) -> None:
        self.state = CalibrationState.WAITING if delay_seconds > 0 else CalibrationState.RUNNING
        self.message = "Salí de la habitación: la calibración empieza en unos segundos."
        self._calibration_start = now + delay_seconds
        self._calibration_end = self._calibration_start + duration_seconds
        self._calibration_samples = []

    def calibration_progress(self, now: float) -> tuple[float, float]:
        """Devuelve (progreso entre 0 y 1, segundos restantes) de la etapa actual."""
        self._advance_calibration(now)
        if self.state == CalibrationState.WAITING:
            return 0.0, max(0.0, self._calibration_start - now)
        if self.state == CalibrationState.RUNNING:
            duration = self._calibration_end - self._calibration_start
            elapsed = now - self._calibration_start
            return min(1.0, elapsed / duration), max(0.0, self._calibration_end - now)
        return (1.0, 0.0) if self.state == CalibrationState.READY else (0.0, 0.0)

    def _advance_calibration(self, now: float) -> None:
        if self.state == CalibrationState.WAITING and now >= self._calibration_start:
            self.state = CalibrationState.RUNNING
            self.message = "Calibrando: mantené la habitación vacía y sin movimiento cerca."
        if self.state == CalibrationState.RUNNING and now >= self._calibration_end:
            self._finish_calibration()

    def _finish_calibration(self) -> None:
        samples = self._calibration_samples
        self._calibration_samples = []
        if len(samples) < MIN_CALIBRATION_SAMPLES:
            self.state = CalibrationState.READY if self.reference_profile is not None else CalibrationState.NOT_CALIBRATED
            self.message = (f"Calibración fallida: llegaron {len(samples)} paquetes (mínimo {MIN_CALIBRATION_SAMPLES}). "
                            "Revisá que el ESP32 esté enviando datos.")
            return

        reference = np.mean([profile(amplitudes) for _, amplitudes in samples], axis=0)
        movement_window, shape_window = TimeWindow(), TimeWindow()
        movement_values, shape_values = [], []
        for now, amplitudes in samples:  # se recorren los paquetes como si llegaran en vivo
            movement_window.add(now, turbulence(amplitudes))
            shape_window.add(now, shape_distance(amplitudes, reference))
            movement, shape = movement_window.std(), shape_window.mean()
            if movement is not None and shape is not None:
                movement_values.append(movement)
                shape_values.append(shape)

        self.reference_profile = reference
        self.movement_threshold = threshold_from(movement_values)
        self.shape_threshold = threshold_from(shape_values)
        self._shape_window.clear()  # la forma se mide contra la referencia nueva
        self.state = CalibrationState.READY
        self.message = f"Calibrado con {len(samples)} paquetes de la habitación vacía."

    # --- Detección -----------------------------------------------------------------------------

    def process(self, now: float, amplitudes: list[float]) -> DetectionResult:
        values = np.asarray(amplitudes, dtype=float)
        self._advance_calibration(now)
        if self.reference_profile is not None and len(values) != len(self.reference_profile):
            self._reset_calibration(f"Cambió la cantidad de subportadoras ({len(values)}); hay que volver a calibrar.")

        self._movement_window.add(now, turbulence(values))
        movement = self._movement_window.std()
        shape = None
        if self.reference_profile is not None:
            self._shape_window.add(now, shape_distance(values, self.reference_profile))
            shape = self._shape_window.mean()

        if self.state == CalibrationState.RUNNING:
            self._calibration_samples.append((now, values))

        ratio = self._detection_ratio(movement, shape)
        presence = self.state == CalibrationState.READY and ratio >= 1.0
        return DetectionResult(float(values.mean()), movement, shape, presence, ratio)

    def _detection_ratio(self, movement: float | None, shape: float | None) -> float:
        ratios = []
        if movement is not None and self.movement_threshold:
            ratios.append(movement / self.movement_threshold)
        if shape is not None and self.shape_threshold:
            ratios.append(shape / self.shape_threshold)
        return max(ratios, default=0.0)

    def _reset_calibration(self, message: str) -> None:
        self.state = CalibrationState.NOT_CALIBRATED
        self.message = message
        self.reference_profile = None
        self.movement_threshold = None
        self.shape_threshold = None
        self._shape_window.clear()
