#include <Arduino.h>
#include <PubSubClient.h>
#include <WiFi.h>

#include "config.h"
#include "network.h"

namespace {
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
char nodeId[32];
uint8_t bssid[6] = {0};
unsigned long lastWifiAttempt = 0;
unsigned long lastMqttAttempt = 0;
}

void beginNetwork() {
  snprintf(nodeId, sizeof(nodeId), "csi-%012llx", (unsigned long long)ESP.getEfuseMac());
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);  // sin ahorro de energía: recepción continua de paquetes
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setBufferSize(1024);  // cada mensaje lleva 55 amplitudes (~450 bytes)
  mqttClient.setSocketTimeout(2);
}

void maintainNetwork() {
  const unsigned long now = millis();
  if (WiFi.status() != WL_CONNECTED) {
    if (now - lastWifiAttempt >= RECONNECT_INTERVAL_MS) {
      lastWifiAttempt = now;
      WiFi.reconnect();
    }
    return;
  }
  memcpy(bssid, WiFi.BSSID(), 6);

  if (!mqttClient.connected() && now - lastMqttAttempt >= RECONNECT_INTERVAL_MS) {
    lastMqttAttempt = now;
    if (mqttClient.connect(nodeId)) {
      Serial.printf("MQTT conectado a %s:%u\n", MQTT_HOST, MQTT_PORT);
    } else {
      Serial.printf("MQTT: fallo de conexion a %s:%u, codigo %d\n", MQTT_HOST, MQTT_PORT, mqttClient.state());
    }
  }
  mqttClient.loop();
}

bool wifiConnected() {
  return WiFi.status() == WL_CONNECTED;
}

bool mqttConnected() {
  return mqttClient.connected();
}

const uint8_t *routerMac() {
  return bssid;
}

bool publishAmplitudes(const float *amplitudes, size_t count) {
  if (!mqttClient.connected()) return false;
  char payload[900];
  int length = snprintf(payload, sizeof(payload), "{\"case_id\":\"csi_router\",\"source\":\"%s\",\"amplitudes\":[", nodeId);
  for (size_t i = 0; i < count && length < (int)sizeof(payload) - 16; i++) {
    length += snprintf(payload + length, sizeof(payload) - length, i ? ",%.1f" : "%.1f", amplitudes[i]);
  }
  length += snprintf(payload + length, sizeof(payload) - length, "]}");
  return mqttClient.publish(MQTT_TOPIC, payload, false);
}
