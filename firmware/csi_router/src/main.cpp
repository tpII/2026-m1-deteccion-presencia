// Caso 2 - ESP32 conectado al router Wi-Fi que captura CSI y publica las amplitudes por MQTT.
//
// 1. Se conecta a la red Wi-Fi del router y al broker MQTT (datos en include/config.h).
// 2. Activa la captura de CSI y hace ping al router para recibir unos 10 paquetes por segundo.
// 3. Por cada paquete del router calcula la amplitud de 55 subportadoras y la publica en
//    presence/csi/router/raw. El backend calcula los indicadores y decide si hay presencia.
#include <Arduino.h>
#include <WiFi.h>

#include "config.h"
#include "csi.h"
#include "network.h"

bool csiStarted = false;
uint32_t published = 0;
uint32_t publishFailures = 0;
unsigned long lastReport = 0;

void startCsiOnceConnected() {
  if (csiStarted || !wifiConnected()) return;
  Serial.print("Wi-Fi conectado. IP del ESP32: ");
  Serial.print(WiFi.localIP());
  Serial.print(" | router: ");
  Serial.print(WiFi.gatewayIP());
  Serial.printf(" | canal %d | RSSI %d dBm\n", WiFi.channel(), WiFi.RSSI());
  if (!startCsi(routerMac())) {
    Serial.println("ERROR: no se pudo activar la captura de CSI.");
    return;
  }
  if (!startPingToGateway(PING_INTERVAL_MS)) {
    Serial.println("ERROR: no se pudo iniciar el ping al router.");
  }
  csiStarted = true;
  Serial.println("Captura de CSI activada.");
}

void reportEveryTenSeconds() {
  const unsigned long now = millis();
  if (now - lastReport < 10000) return;
  lastReport = now;
  const CsiStats stats = csiStats();
  Serial.printf("CSI recibidos: %lu | publicados: %lu | fallas MQTT: %lu | cola llena: %lu | sin HT-LTF: %lu | "
                "Wi-Fi %s | MQTT %s\n",
                (unsigned long)stats.received, (unsigned long)published, (unsigned long)publishFailures,
                (unsigned long)stats.dropped, (unsigned long)stats.withoutHtLtf,
                wifiConnected() ? "ok" : "desconectado", mqttConnected() ? "ok" : "desconectado");
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n===== Caso 2 - CSI con router Wi-Fi (MQTT) =====");
  Serial.printf("Conectando a \"%s\"...\n", WIFI_SSID);
  beginNetwork();
}

void loop() {
  maintainNetwork();
  startCsiOnceConnected();

  float amplitudes[CSI_SUBCARRIERS];
  while (takeCsiAmplitudes(amplitudes)) {
    if (publishAmplitudes(amplitudes, CSI_SUBCARRIERS)) {
      published++;
    } else if (mqttConnected()) {
      publishFailures++;
    }
  }

  reportEveryTenSeconds();
  delay(5);
}
