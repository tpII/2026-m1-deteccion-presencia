#pragma once

#include <Arduino.h>
#include "esp_wifi.h"

constexpr size_t CSI_MAX_LEN = 612;  // máximo ESP32: HT40 + STBC

// El callback copia el paquete; loop() consume la cola e imprime fuera de la tarea Wi-Fi.
struct CsiPacket {
  wifi_pkt_rx_ctrl_t rx;  // encabezado de radio (RSSI, modo, canal, etc.)
  uint8_t mac[6];         // MAC de quien envio el paquete
  bool firstWordInvalid;  // los primeros 4 bytes pueden ser invalidos (limitacion del ESP32)
  uint16_t len;           // cantidad de bytes de CSI
  int8_t buf[CSI_MAX_LEN];
};

struct CaptureStats {
  uint32_t packets;
  uint32_t dropped;
  uint32_t other;
};

bool startCsi(const uint8_t routerMac[6]);
bool readCsiPacket(CsiPacket &packet);
CaptureStats captureStats();
