#pragma once

#include <stdint.h>

constexpr uint8_t PIR_PIN = 27;
constexpr unsigned long SAMPLE_INTERVAL_MS = 500;
constexpr unsigned long RECONNECT_INTERVAL_MS = 5000;

constexpr char WIFI_SSID[] = "TU_RED_WIFI";
constexpr char WIFI_PASSWORD[] = "TU_CLAVE_WIFI";
constexpr char MQTT_HOST[] = "192.168.1.100";
constexpr uint16_t MQTT_PORT = 1883;
constexpr char MQTT_TOPIC[] = "presence/pir/telemetry";
