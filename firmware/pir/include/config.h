#pragma once

#include <stdint.h>

constexpr uint8_t PIR_PIN = 27;
constexpr unsigned long SAMPLE_INTERVAL_MS = 100; //antes era 500ms, se modifica a 100 para igualarlo al del csi.
constexpr unsigned long RECONNECT_INTERVAL_MS = 5000;

constexpr char WIFI_SSID[] = "Iphone de Emiliano";
constexpr char WIFI_PASSWORD[] = "playaunion1";
constexpr char MQTT_HOST[] = "172.20.10.3";
constexpr uint16_t MQTT_PORT = 1883;
constexpr char MQTT_TOPIC[] = "sensores/pir/presencia";

// Disponibilidad de esta placa, independiente de las muestras.
constexpr char MQTT_STATUS_TOPIC[] = "sensores/pir/estado_esp32";
constexpr uint16_t MQTT_KEEPALIVE_SECONDS = 15;
