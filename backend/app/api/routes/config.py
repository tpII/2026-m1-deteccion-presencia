"""Rutas REST para configuración de nodos ESP32."""

import json
from typing import Dict, Any
from fastapi import APIRouter, HTTPException
from app.schemas.config import (
    SystemNodesConfig,
)
from app.core.logging import logger

router = APIRouter(prefix="/config", tags=["Configuración y Calibración"])

# Estado de configuración en memoria (editable en tiempo de ejecución)
_current_config = SystemNodesConfig()

@router.get("/nodes", response_model=Dict[str, Any])
async def get_nodes_configuration():
    """Retorna la configuración actual de todos los nodos ESP32 y parámetros de radio."""
    return {
        "broker_host": _current_config.broker_host,
        "broker_port": _current_config.broker_port,
        "pir": _current_config.pir.model_dump(),
        "csi_router": {
            **_current_config.csi_router.model_dump(),
            "frequency_mhz": _current_config.csi_router.frequency_mhz,
        },
        "csi_dedicated": {
            **_current_config.csi_dedicated.model_dump(),
            "frequency_mhz": _current_config.csi_dedicated.frequency_mhz,
        },
    }


@router.post("/nodes", response_model=Dict[str, Any])
async def update_nodes_configuration(config_update: SystemNodesConfig):
    """
    Actualiza la configuración de los nodos microcontroladores en memoria.
    Despacha los parámetros a los tópicos de control de los ESP32.
    """
    global _current_config
    _current_config = config_update
    logger.info("Configuración de nodos ESP32 actualizada exitosamente.")

    # Intentar publicar por MQTT a los tópicos de control de los nodos si hay cliente activo
    try:
        import paho.mqtt.publish as publish
        msgs = [
            {
                "topic": "presence/nodes/pir/config",
                "payload": json.dumps(_current_config.pir.model_dump()),
                "qos": 1,
            },
            {
                "topic": "presence/nodes/csi_router/config",
                "payload": json.dumps(_current_config.csi_router.model_dump()),
                "qos": 1,
            },
            {
                "topic": "presence/nodes/csi_dedicated/config",
                "payload": json.dumps(_current_config.csi_dedicated.model_dump()),
                "qos": 1,
            },
        ]
        publish.multiple(msgs, hostname=_current_config.broker_host, port=_current_config.broker_port)
        logger.info("Comandos de configuración despachados vía MQTT a los ESP32.")
    except Exception as e:
        logger.warning(f"No se pudieron enviar comandos MQTT a los nodos físicos: {e}")

    return {
        "status": "updated",
        "config": {
            "broker_host": _current_config.broker_host,
            "broker_port": _current_config.broker_port,
            "pir": _current_config.pir.model_dump(),
            "csi_router": {
                **_current_config.csi_router.model_dump(),
                "frequency_mhz": _current_config.csi_router.frequency_mhz,
            },
            "csi_dedicated": {
                **_current_config.csi_dedicated.model_dump(),
                "frequency_mhz": _current_config.csi_dedicated.frequency_mhz,
            },
        },
    }


@router.get("/header/{node_id}", response_model=Dict[str, str])
async def generate_c_header(node_id: str):
    """
    Genera el archivo de cabecera en C/C++ 'config.h' listo para flashear
    en PlatformIO o Arduino IDE para el nodo seleccionado.
    """
    node_id_lower = node_id.lower()

    if node_id_lower in ("pir", "esp32_pir_node_01"):
        c_code = f"""/**
 * @file config_pir.h
 * @brief Configuración generada automáticamente para Nodo ESP32 #1 (PIR)
 * Proyecto: Detección de Presencia Humana - Facultad de Ingeniería
 */

#ifndef CONFIG_PIR_H_
#define CONFIG_PIR_H_

// --- Red y Broker MQTT ---
#define MQTT_BROKER_HOST     "{_current_config.broker_host}"
#define MQTT_BROKER_PORT     {_current_config.broker_port}
#define MQTT_CLIENT_ID       "{_current_config.pir.node_id}"
#define MQTT_TELEMETRY_TOPIC "{_current_config.pir.mqtt_topic}"

// --- Parámetros de Hardware PIR ---
#define PIR_GPIO_PIN         {_current_config.pir.gpio_pin}
#define PIR_TRIGGER_MODE     {_current_config.pir.trigger_mode}
#define PIR_DEBOUNCE_MS      {_current_config.pir.debounce_ms}
#define PIR_SAMPLE_RATE_MS   {_current_config.pir.sample_interval_ms}

#endif // CONFIG_PIR_H_
"""
        return {"node_id": "pir", "filename": "config_pir.h", "content": c_code}

    elif node_id_lower in ("csi_router", "esp32_csi_sta_node"):
        freq = _current_config.csi_router.frequency_mhz
        c_code = f"""/**
 * @file config_csi_router.h
 * @brief Configuración generada automáticamente para Nodo ESP32 #2 (CSI Router STA)
 * Proyecto: Detección de Presencia Humana - Facultad de Ingeniería
 */

#ifndef CONFIG_CSI_ROUTER_H_
#define CONFIG_CSI_ROUTER_H_

// --- Red Wi-Fi y Canal 2.4 GHz ---
#define TARGET_WIFI_SSID     "{_current_config.csi_router.target_ssid}"
#define WIFI_CHANNEL         {_current_config.csi_router.wifi_channel}
#define WIFI_FREQ_MHZ        {freq}  // Frecuencia central portadora

// --- Broker MQTT ---
#define MQTT_BROKER_HOST     "{_current_config.broker_host}"
#define MQTT_BROKER_PORT     {_current_config.broker_port}
#define MQTT_CLIENT_ID       "{_current_config.csi_router.node_id}"
#define MQTT_TELEMETRY_TOPIC "{_current_config.csi_router.mqtt_topic}"

// --- Parámetros de Captura CSI ---
#define CSI_SAMPLING_RATE_HZ {_current_config.csi_router.sampling_rate_hz}
#define CSI_SUBCARRIER_MODE  "{_current_config.csi_router.subcarriers_mode}"

#endif // CONFIG_CSI_ROUTER_H_
"""
        return {"node_id": "csi_router", "filename": "config_csi_router.h", "content": c_code}

    elif node_id_lower in ("csi_dedicated", "esp32_dedicated_pair"):
        freq = _current_config.csi_dedicated.frequency_mhz
        c_code = f"""/**
 * @file config_csi_dedicated.h
 * @brief Configuración generada automáticamente para Par ESP32 #3 y #4 (CSI Dedicado AP-STA)
 * Proyecto: Detección de Presencia Humana - Facultad de Ingeniería
 */

#ifndef CONFIG_CSI_DEDICATED_H_
#define CONFIG_CSI_DEDICATED_H_

// --- Radiofrecuencia y Enlace Wi-Fi Cerrado ---
#define DEDICATED_WIFI_CHANNEL {_current_config.csi_dedicated.wifi_channel}
#define DEDICATED_FREQ_MHZ      {freq}
#define DEDICATED_TX_POWER_DBM  {_current_config.csi_dedicated.tx_power_dbm}
#define DEDICATED_BSSID         "{_current_config.csi_dedicated.custom_bssid}"
#define PACKET_INJECTION_RATE_HZ {_current_config.csi_dedicated.packet_rate_hz}

// --- Broker MQTT ---
#define MQTT_BROKER_HOST        "{_current_config.broker_host}"
#define MQTT_BROKER_PORT        {_current_config.broker_port}
#define MQTT_CLIENT_ID          "{_current_config.csi_dedicated.node_id}"
#define MQTT_TELEMETRY_TOPIC    "{_current_config.csi_dedicated.mqtt_topic}"

#endif // CONFIG_CSI_DEDICATED_H_
"""
        return {"node_id": "csi_dedicated", "filename": "config_csi_dedicated.h", "content": c_code}

    else:
        raise HTTPException(
            status_code=404,
            detail=f"Nodo '{node_id}' desconocido. Opciones válidas: 'pir', 'csi_router', 'csi_dedicated'.",
        )
