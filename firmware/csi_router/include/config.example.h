#pragma once

// Copiar este archivo como config.h y completar los datos de la red.
// config.h no se sube al repositorio (está en .gitignore).

#include <stdint.h>

//wifi fran:
//WIFI_SSID "Personal-830"
//WIFI_PASS "39F91ED830"

constexpr char WIFI_SSID[] = "Personal-830";
constexpr char WIFI_PASSWORD[] = "39F91ED830";

// IP de la computadora donde corre Mosquitto (ipconfig en Windows) y el backend.
constexpr char MQTT_HOST[] = "192.168.0.100";
constexpr uint16_t MQTT_PORT = 1883;
constexpr char MQTT_TOPIC[] = "presence/csi/router/raw";

// Ping al router para que responda paquetes de forma constante: cada respuesta genera un paquete CSI.
constexpr uint32_t PING_INTERVAL_MS = 100;  // 10 paquetes por segundo
constexpr unsigned long RECONNECT_INTERVAL_MS = 5000;
