"""Contrato de recepción de telemetría."""

from abc import ABC, abstractmethod
from typing import Callable, Awaitable, Any


class DataSource(ABC):
    """
    Contrato unificado para proveedores de datos.
    Separa la recepción de telemetría física del procesamiento y la API de WebSockets.
    """

    @abstractmethod
    async def start(self):
        """Inicia el bucle de recepción."""
        pass

    @abstractmethod
    async def stop(self):
        """Detiene de manera limpia los recursos o conexiones."""
        pass

    @abstractmethod
    def set_sample_handler(self, handler: Callable[[str, Any], Awaitable[None]]):
        """Registra el callback que recibe (case_id, payload)."""
        pass
