"""Configuración global de la aplicación basada en Pydantic Settings."""

from typing import List, Literal
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Misma configuracion al iniciar desde la raiz o desde backend/.
        env_file=(Path(__file__).resolve().parents[3] / ".env", Path(__file__).resolve().parents[2] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_NAME: str = "Presencia CSI & PIR API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Telemetría recibida de los nodos físicos por MQTT.
    DATA_SOURCE: Literal["mqtt"] = "mqtt"

    # Broker MQTT
    MQTT_HOST: str = "localhost"
    MQTT_PORT: int = 1883
    MQTT_KEEPALIVE: int = 60
    MQTT_CLIENT_ID: str = "presence_backend_service"

    # Base de Datos SQLite Asíncrona
    DATABASE_URL: str = "sqlite+aiosqlite:///./presence-hardware.db"

    # CORS
    CORS_ORIGINS: str | List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    # Nivel de log
    LOG_LEVEL: str = "INFO"

    @property
    def cors_origins(self) -> List[str]:
        if isinstance(self.CORS_ORIGINS, str):
            import json
            if self.CORS_ORIGINS.startswith("["):
                try:
                    return json.loads(self.CORS_ORIGINS)
                except Exception:
                    pass
            return [i.strip() for i in self.CORS_ORIGINS.split(",") if i.strip()]
        return list(self.CORS_ORIGINS)


settings = Settings()
