#include <WiFi.h>
#include <PubSubClient.h>
#include "config.h"

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
char nodeId[32];
unsigned long lastWifiAttempt = 0;
unsigned long lastMqttAttempt = 0;
unsigned long lastSample = 0;

void maintainConnections(unsigned long now) {
  if (WiFi.status() != WL_CONNECTED) {
    if (now - lastWifiAttempt >= RECONNECT_INTERVAL_MS) {
      lastWifiAttempt = now;
      Serial.println("Wi-Fi: reintentando conexion...");
      WiFi.reconnect();
    }
    return;
  }

  if (!mqttClient.connected() && now - lastMqttAttempt >= RECONNECT_INTERVAL_MS) {
    lastMqttAttempt = now;
    Serial.printf("MQTT: conectando a %s:%u...\n", MQTT_HOST, MQTT_PORT);
    if (mqttClient.connect(nodeId)) {
      Serial.print("MQTT conectado. IP ESP32: ");
      Serial.println(WiFi.localIP());
    } else {
      Serial.printf("MQTT: fallo de conexion, codigo %d\n", mqttClient.state());
    }
  }
  mqttClient.loop();
}

void publishReading(bool motion) {
  char payload[192];
  // Sin reloj sincronizado ni medicion de latencia: el backend usa la hora de
  // recepcion y latency_ms=0 por defecto. No se inventa ground_truth.
  snprintf(payload, sizeof(payload),
           "{\"case_id\":\"pir\",\"source\":\"%s\",\"presence\":%s,\"raw_value\":%d}",
           nodeId, motion ? "true" : "false", motion ? 1 : 0);

  // QoS 0 y sin retain: al conectar no se reutilizan detecciones antiguas.
  if (!mqttClient.publish(MQTT_TOPIC, payload, false)) {
    Serial.println("MQTT: no se pudo publicar la lectura.");
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  // Identificador unico por placa para evitar desconectar otro nodo PIR.
  snprintf(nodeId, sizeof(nodeId), "pir-%012llx", (unsigned long long)ESP.getEfuseMac());
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setSocketTimeout(2);
  Serial.println("Prueba PIR MQTT iniciada. Esperando Wi-Fi...");
}

void loop() {
  unsigned long now = millis();
  maintainConnections(now);
  // Volver a leer millis(): un intento TCP/MQTT puede tardar unos segundos.
  now = millis();
  if (now - lastSample >= SAMPLE_INTERVAL_MS) {
    lastSample = now;
    bool motion = digitalRead(PIR_PIN) == HIGH;
    // Estos mensajes conservan la compatibilidad con la prueba USB existente.
    Serial.println(motion ? "MOVIMIENTO" : "SIN MOVIMIENTO");
    if (WiFi.status() == WL_CONNECTED && mqttClient.connected()) {
      publishReading(motion);
    }
  }
  delay(5);
}
