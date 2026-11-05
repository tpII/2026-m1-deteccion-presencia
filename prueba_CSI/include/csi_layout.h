#pragma once

#include "esp_wifi.h"

struct Segment {
  const char *name;
  uint8_t pos;  // cantidad de indices positivos (empiezan en 0)
  uint8_t neg;  // cantidad de indices negativos (terminan en -1)
};

// Orden del buffer: índices positivos y luego negativos; cada par es [imag, real].
int csiLayout(const wifi_pkt_rx_ctrl_t &rx, Segment out[3]);
const char *subcarrierRole(const char *segment, int k, uint8_t secondaryChannel);
