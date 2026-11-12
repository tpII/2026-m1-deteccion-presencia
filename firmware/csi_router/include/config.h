#pragma once

#include <stdint.h>

// Completar para la prueba; no subir credenciales reales a Git.
constexpr char WIFI_SSID[] = "TU_RED_WIFI";
constexpr char WIFI_PASSWORD[] = "TU_CLAVE_WIFI";

// IP de la computadora donde corre Mosquitto (ipconfig en Windows) y el backend.
constexpr char MQTT_HOST[] = "192.168.1.100";
constexpr uint16_t MQTT_PORT = 1883;
constexpr char MQTT_TOPIC[] = "sensores/csi/amplitudes";

// Ping al router para que responda paquetes de forma constante: cada respuesta genera un paquete CSI.
constexpr uint32_t PING_INTERVAL_MS = 100;  // 10 paquetes por segundo
constexpr unsigned long RECONNECT_INTERVAL_MS = 5000;

// Disponibilidad de esta placa, independiente de las muestras.
constexpr char MQTT_STATUS_TOPIC[] = "sensores/csi/estado_esp32";
constexpr uint16_t MQTT_KEEPALIVE_SECONDS = 15;
