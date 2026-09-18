"""Clases base y contratos para filtros y extracción de características."""

from abc import ABC, abstractmethod
from typing import List, Dict, Any


class SignalFilter(ABC):
    """Contrato base para algoritmos de filtrado de señal."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Nombre descriptivo del filtro."""
        pass

    @property
    @abstractmethod
    def parameters(self) -> Dict[str, Any]:
        """Parámetros de configuración del filtro para inspección en UI."""
        pass

    @abstractmethod
    def apply(self, signal: List[float]) -> List[float]:
        """Aplica el filtrado sobre la secuencia de entrada y retorna la señal filtrada."""
        pass


class FeatureExtractor(ABC):
    """Contrato base para cálculo de descriptores estadísticos y energéticos."""

    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    def extract(self, signal: List[float]) -> float:
        """Calcula una métrica escalar a partir de la señal."""
        pass
