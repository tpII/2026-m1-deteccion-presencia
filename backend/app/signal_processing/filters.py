import numpy as np


class HampelFilter:
    def __init__(self, window_size: int = 7, n_sigmas: float = 3.0):
        if window_size < 1 or n_sigmas <= 0:
            raise ValueError("La ventana y el umbral de Hampel deben ser positivos")
        if window_size % 2 == 0:
            window_size += 1
        self.window_size = window_size
        self.n_sigmas = n_sigmas

    def apply(self, signal: list[float]) -> list[float]:
        sample_count = len(signal)
        if sample_count < self.window_size:
            return list(signal)

        values = np.array(signal, dtype=float)
        filtered = values.copy()
        radius = self.window_size // 2

        mad_to_standard_deviation = 1.4826

        for index in range(radius, sample_count - radius):
            window = values[index - radius : index + radius + 1]
            median = np.median(window)
            mad = np.median(np.abs(window - median))
            threshold = self.n_sigmas * mad_to_standard_deviation * mad

            if np.abs(values[index] - median) > threshold:
                filtered[index] = median

        return filtered.tolist()


class MovingAverageFilter:
    def __init__(self, window_size: int = 5):
        if window_size < 1:
            raise ValueError("El tamaño de ventana debe ser mayor o igual a 1")
        self.window_size = window_size

    def apply(self, signal: list[float]) -> list[float]:
        if not signal:
            return []
        if len(signal) < self.window_size:
            return list(signal)

        values = np.array(signal, dtype=float)
        pad_left = self.window_size // 2
        pad_right = self.window_size - 1 - pad_left
        padded = np.pad(values, (pad_left, pad_right), mode="edge")
        kernel = np.ones(self.window_size) / self.window_size
        filtered = np.convolve(padded, kernel, mode="valid")
        return filtered.tolist()
