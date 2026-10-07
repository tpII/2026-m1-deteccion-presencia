"""Esquemas de configuración para nodos ESP32."""

from typing import Optional
from pydantic import BaseModel, Field, field_validator


def channel_to_mhz(channel: int) -> int:
    """Calcula la frecuencia central en MHz para la banda Wi-Fi 2.4 GHz (canales 1 a 13)."""
    return 2412 + (channel - 1) * 5


class PirNodeConfig(BaseModel):
    """Configuración del nodo ESP32 #1 (Sensor PIR)."""
    node_id: str = "esp32_pir_node_01"
    gpio_pin: int = Field(27, ge=0, le=39, description="Pin GPIO donde se conecta la salida OUT del PIR")
    trigger_mode: str = Field("RISING", description="Modo de interrupción: RISING, FALLING o CHANGE")
    debounce_ms: int = Field(3000, ge=100, le=30000, description="Tiempo de retención en ms para evitar rebotes")
    sample_interval_ms: int = Field(200, ge=20, le=5000, description="Intervalo de sondeo o reporte periódico")
    mqtt_topic: str = "presence/pir/telemetry"

    @field_validator("trigger_mode")
    @classmethod
    def validate_trigger(cls, v: str) -> str:
        valid = ["RISING", "FALLING", "CHANGE"]
        if v.upper() not in valid:
            raise ValueError(f"trigger_mode debe ser uno de: {valid}")
        return v.upper()


class CsiRouterConfig(BaseModel):
    """Configuración del nodo ESP32 #2 (CSI con Router Wi-Fi Comercial)."""
    node_id: str = "esp32_csi_sta_node"
    wifi_channel: int = Field(6, ge=1, le=13, description="Canal Wi-Fi de 2.4 GHz (1 a 13)")
    target_ssid: str = Field("Laboratorio-WiFi", description="SSID del router comercial objetivo")
    target_bssid: Optional[str] = Field("", description="BSSID / Dirección MAC del router (opcional)")
    sampling_rate_hz: int = Field(20, ge=5, le=100, description="Tasa de captura de tramas CSI en Hertz")
    subcarriers_mode: str = Field("PRIMARY", description="Modo de análisis: PRIMARY, ALL_64 o PILOT")
    mqtt_topic: str = "presence/csi/router/raw"

    @property
    def frequency_mhz(self) -> int:
        return channel_to_mhz(self.wifi_channel)


class CsiDedicatedConfig(BaseModel):
    """Configuración del par ESP32 #3 y #4 (Enlace CSI Wi-Fi Dedicado)."""
    node_id: str = "esp32_dedicated_pair"
    wifi_channel: int = Field(1, ge=1, le=13, description="Canal Wi-Fi de 2.4 GHz para el enlace punto a punto")
    tx_power_dbm: int = Field(16, ge=8, le=20, description="Potencia de transmisión en dBm (8 a 20)")
    packet_rate_hz: int = Field(40, ge=5, le=100, description="Tasa de inyección de paquetes del AP al STA en Hz")
    custom_bssid: str = Field("02:00:00:00:00:01", description="BSSID virtual para el enlace cerrado")
    mqtt_topic: str = "presence/csi/dedicated/raw"

    @property
    def frequency_mhz(self) -> int:
        return channel_to_mhz(self.wifi_channel)


class SystemNodesConfig(BaseModel):
    """Configuración consolidada de todos los dispositivos del laboratorio."""
    broker_host: str = Field("localhost", description="IP o hostname del Broker Mosquitto")
    broker_port: int = Field(1883, ge=1, le=65535, description="Puerto del Broker MQTT")
    pir: PirNodeConfig = Field(default_factory=PirNodeConfig)
    csi_router: CsiRouterConfig = Field(default_factory=CsiRouterConfig)
    csi_dedicated: CsiDedicatedConfig = Field(default_factory=CsiDedicatedConfig)
