#include <Arduino.h>
#include <MQTT.h>
#include <WiFi.h>

#include "config.h"
#include "network.h"

namespace {
WiFiClient wifiClient;
MQTTClient mqttClient(256);
char nodeId[32];
unsigned long lastWifiAttempt = 0;
unsigned long lastMqttAttempt = 0;
}

void beginNetwork() {
  snprintf(nodeId, sizeof(nodeId), "pir-%012llx", (unsigned long long)ESP.getEfuseMac());
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  mqttClient.begin(MQTT_HOST, MQTT_PORT, wifiClient);
  mqttClient.setWill(MQTT_STATUS_TOPIC, "offline", true, 1);
  mqttClient.setKeepAlive(MQTT_KEEPALIVE_SECONDS);
  mqttClient.setTimeout(2000);
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
      // Reanunciar en cada conexión; el broker conserva el último estado.
      if (!mqttClient.publish(MQTT_STATUS_TOPIC, "online", true, 1)) {
        Serial.println("MQTT: no se pudo confirmar el estado online.");
        // Cerrar sin DISCONNECT permite que el broker emita la última voluntad.
        wifiClient.stop();
        return;
      }
      Serial.print("MQTT conectado. IP ESP32: ");
      Serial.println(WiFi.localIP());
    } else {
      Serial.printf("MQTT: fallo de conexion, codigo %d\n", mqttClient.lastError());
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
  if (!mqttClient.publish(MQTT_TOPIC, payload, false, 0)) {
    Serial.println("MQTT: no se pudo publicar la lectura.");
  }
}
