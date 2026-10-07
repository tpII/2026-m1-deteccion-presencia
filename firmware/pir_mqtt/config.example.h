#pragma once

// Copiar como config.h y completar antes de subir el firmware.
// La ESP32 clásica necesita una red Wi-Fi de 2.4 GHz.
const char WIFI_SSID[] = "TU_RED_WIFI";
const char WIFI_PASSWORD[] = "TU_CLAVE_WIFI";

// IP LAN de la computadora que ejecuta Mosquitto, nunca localhost.
const char MQTT_HOST[] = "192.168.1.100";
const uint16_t MQTT_PORT = 1883;
const char MQTT_TOPIC[] = "presence/pir/telemetry";

const uint8_t PIR_PIN = 27;
const unsigned long SAMPLE_INTERVAL_MS = 200;
const unsigned long RECONNECT_INTERVAL_MS = 5000;
