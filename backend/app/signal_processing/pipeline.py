import numpy as np
from app.signal_processing.filters import HampelFilter, MovingAverageFilter
from app.schemas.telemetry import FilterMetadata, FeatureMetrics


class CsiSignalPipeline:
    def __init__(
        self,
        hampel_window: int = 7,
        hampel_sigmas: float = 3.0,
        ma_window: int = 5,
        variance_threshold: float = 2.2,
    ):
        if variance_threshold <= 0:
            raise ValueError("El umbral de varianza debe ser positivo")
        self.hampel = HampelFilter(window_size=hampel_window, n_sigmas=hampel_sigmas)
        self.moving_average = MovingAverageFilter(window_size=ma_window)
        self.variance_threshold = variance_threshold

    def get_filter_metadata(self) -> FilterMetadata:
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

    def process_window(self, raw_signal: list[float]) -> tuple[list[float], FeatureMetrics, bool]:
        if not raw_signal:
            default_features = FeatureMetrics(
                variance=0.0,
                energy=0.0,
                detection_score=0.0,
                threshold_applied=self.variance_threshold,
            )
            return [], default_features, False

        hampel_cleaned = self.hampel.apply(raw_signal)

        filtered_signal = self.moving_average.apply(hampel_cleaned)

        window_for_features = filtered_signal[-20:]
        values = np.array(window_for_features, dtype=float)
        variance = float(np.var(values))
        energy = float(np.mean(values ** 2))

        score_slope = 1.2
        variance_above_threshold = variance - self.variance_threshold
        detection_score = float(1.0 / (1.0 + np.exp(-score_slope * np.clip(variance_above_threshold, -10.0, 10.0))))

        periodicity_ratio, target_type = self._classify_target(window_for_features, variance)
        presence_detected = variance >= self.variance_threshold

        features = FeatureMetrics(
            variance=round(variance, 4),
            energy=round(energy, 4),
            detection_score=round(detection_score, 4),
            threshold_applied=self.variance_threshold,
            periodicity_ratio=round(periodicity_ratio, 4),
            target_type=target_type,
        )

        return filtered_signal, features, presence_detected

    def _classify_target(self, signal_window: list[float], variance: float) -> tuple[float, str]:
        if len(signal_window) < 8 or variance < 0.25:
            return 0.0, "empty"

        values = np.array(signal_window, dtype=float)
        detrended = values - np.mean(values)

        spectral_power = np.abs(np.fft.rfft(detrended)[1:]) ** 2
        total_power = float(np.sum(spectral_power))
        periodicity_ratio = float(np.max(spectral_power) / total_power) if total_power > 1e-6 else 0.0

        if periodicity_ratio >= 0.40 and variance >= self.variance_threshold * 0.5:
            target_type = "object_fan"
        elif self._is_step_change(values):
            target_type = "object_moved"
        elif variance >= self.variance_threshold:
            target_type = "person_active"
        elif variance >= 0.35:
            target_type = "person_static"
        else:
            target_type = "empty"

        return periodicity_ratio, target_type

    @staticmethod
    def _is_step_change(values: np.ndarray) -> bool:
        if len(values) < 14:
            return False
        midpoint = len(values) // 2
        first_half, second_half = values[:midpoint], values[midpoint:]
        mean_shift = abs(float(np.mean(second_half) - np.mean(first_half)))
        settled_variance = float(np.var(second_half))
        return mean_shift > 2.5 and settled_variance < 0.9
