#include <Arduino.h>
#include <PubSubClient.h>
#include <WiFi.h>

#include "config.h"
#include "network.h"

namespace {
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
char nodeId[32];
unsigned long lastWifiAttempt = 0;
unsigned long lastMqttAttempt = 0;
}

void beginNetwork() {
  snprintf(nodeId, sizeof(nodeId), "pir-%012llx", (unsigned long long)ESP.getEfuseMac());
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
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

  if (!mqttClient.connected() && now - lastMqttAttempt >= RECONNECT_INTERVAL_MS) {
    lastMqttAttempt = now;
    if (mqttClient.connect(nodeId)) {
      Serial.print("MQTT conectado. IP ESP32: ");
      Serial.println(WiFi.localIP());
    } else {
      Serial.printf("MQTT: fallo de conexion, codigo %d\n", mqttClient.state());
    }
  }
  mqttClient.loop();
}

void publishPresence(bool motion) {
  if (!mqttClient.connected()) return;
  char payload[192];
  snprintf(payload, sizeof(payload),
           "{\"case_id\":\"pir\",\"source\":\"%s\",\"presence\":%s,\"raw_value\":%d}",
           nodeId, motion ? "true" : "false", motion ? 1 : 0);
  if (!mqttClient.publish(MQTT_TOPIC, payload, false)) {
    Serial.println("MQTT: no se pudo publicar la lectura.");
  }
}
