// Captura CSI desde el router y comandos Serial (d, n, c, s, h).
// Wi-Fi y ping generan tráfico; el callback encola y este loop imprime.
#include <Arduino.h>
#include <WiFi.h>
#include "csi_capture.h"
#include "router_network.h"
#include "serial_output.h"

static uint8_t routerMac[6];
static bool printCsv = false;
static bool printOne = false;
static bool dissectNext = true;
static uint32_t seq = 0;

static void printStats() {
  const CaptureStats stats = captureStats();
  static uint32_t lastCount = 0, lastMs = 0;
  const uint32_t now = millis();
  const float rate = lastMs ? 1000.0f * (stats.packets - lastCount) / (now - lastMs) : 0;
  lastCount = stats.packets;
  lastMs = now;
  Serial.printf("# Paquetes CSI: %lu | ~%.1f paquetes/s | descartados (cola llena): %lu | de otras MAC: %lu | RSSI router: %d dBm\n",
                (unsigned long)stats.packets, rate, (unsigned long)stats.dropped, (unsigned long)stats.other, WiFi.RSSI());
}

void setup() {
  Serial.begin(921600);
  delay(500);
  Serial.println();
  Serial.println("# ===== Caso 2 - Captura de CSI desde el router =====");

  if (!connectWifi(routerMac)) {
    Serial.println("# Revisa WIFI_SSID / WIFI_PASS en include/wifi_secrets.h. Reiniciando en 10 s...");
    delay(10000);
    ESP.restart();
  }
  if (!startCsi(routerMac)) {
    while (true) delay(1000);
  }
  startPing();

  printHelp();
  printCsvHeader();
}

void loop() {
  static CsiPacket pkt;
  static uint32_t lastStats = 0;

  while (Serial.available()) {
    switch (Serial.read()) {
      case 'd': case 'D': dissectNext = true; break;
      case 'n': case 'N': printOne = true; break;
      case 'c': case 'C':
        printCsv = !printCsv;
        Serial.printf("# Lineas CSV %s\n", printCsv ? "activadas" : "desactivadas");
        break;
      case 's': case 'S': printStats(); break;
      case 'h': case 'H': printHelp(); break;
      default: break;
    }
  }

  if (readCsiPacket(pkt)) {
    seq++;
    if (dissectNext) {
      dissectNext = false;
      dissect(pkt, routerMac);
    }
    if (printCsv || printOne) {
      printOne = false;
      printCsvLine(pkt, seq);
    }
  }

  // Estadisticas automaticas cada 10 s (tambien avisan si no llega nada)
  if (millis() - lastStats >= 10000) {
    lastStats = millis();
    printStats();
  }
}
