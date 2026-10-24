from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(Path(__file__).resolve().parents[2] / ".env", Path(__file__).resolve().parents[1] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Presencia CSI & PIR API"
    APP_VERSION: str = "1.0.0"
    APP_DEBUG: bool = False
    DATA_SOURCE: Literal["mqtt"] = "mqtt"
    MQTT_HOST: str = "localhost"
    MQTT_PORT: int = Field(default=1883, ge=1, le=65535)
    MQTT_KEEPALIVE: int = Field(default=60, ge=1)
    MQTT_CLIENT_ID: str = "presence_backend_service"
    DATABASE_URL: str = "sqlite+aiosqlite:///./presence-hardware.db"
    CORS_ORIGINS: str | list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]
    LOG_LEVEL: str = "INFO"

    @property
    def cors_origins(self) -> list[str]:
        if isinstance(self.CORS_ORIGINS, str):
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        return self.CORS_ORIGINS

    @property
    def database_path(self) -> Path:
        for prefix in ("sqlite+aiosqlite:///", "sqlite:///"):
            if self.DATABASE_URL.startswith(prefix):
                return Path(self.DATABASE_URL.removeprefix(prefix))
        raise ValueError("DATABASE_URL debe apuntar a una base SQLite")


settings = Settings()
