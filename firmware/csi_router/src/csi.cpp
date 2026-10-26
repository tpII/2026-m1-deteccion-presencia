// Captura de CSI y cálculo de amplitudes.
//
// El chip Wi-Fi llama a csiCallback por cada paquete recibido. El callback corre en la tarea
// Wi-Fi, así que solo copia el bloque HT-LTF a una cola; loop() calcula las amplitudes y publica.
//
// Formato del buffer (ESP-IDF v4.4, "Wi-Fi Channel State Information"): cada subportadora ocupa
// 2 bytes [imaginaria, real]. Con canal de 20 MHz, el bloque LLTF va en los bytes 0..127 y el
// HT-LTF en los bytes 128..255, con las subportadoras en el orden 0..31, -32..-1.
#include "csi.h"

#include <Arduino.h>
#include <WiFi.h>
#include <math.h>
#include <string.h>

#include "esp_wifi.h"
#include "ping/ping_sock.h"

namespace {

constexpr size_t HTLTF_OFFSET = 128;
constexpr size_t BLOCK_BYTES = 128;  // 64 subportadoras x 2 bytes
constexpr int QUEUE_LENGTH = 16;

struct CsiBlock {
  int8_t data[BLOCK_BYTES];
};

QueueHandle_t queue = nullptr;
uint8_t router[6] = {0};
volatile uint32_t received = 0;
volatile uint32_t dropped = 0;
volatile uint32_t withoutHtLtf = 0;

// Posición en el bloque de cada subportadora usada, ordenadas de k = -28 a k = 28.
int positions[CSI_SUBCARRIERS];

void buildPositions() {
  size_t index = 0;
  for (int k = -28; k <= 28; k++) {
    if (k == 0 || k == 1) continue;  // k = 0 no lleva señal (DC); k = 1 se descarta como en el análisis
    positions[index++] = k >= 0 ? k : 64 + k;
  }
}

void csiCallback(void *, wifi_csi_info_t *info) {
  if (!info || !info->buf || memcmp(info->mac, router, 6) != 0) return;  // solo paquetes del router
  received++;
  if (info->len < HTLTF_OFFSET + BLOCK_BYTES) {
    withoutHtLtf++;
    return;
  }
  CsiBlock block;
  memcpy(block.data, info->buf + HTLTF_OFFSET, BLOCK_BYTES);
  if (xQueueSend(queue, &block, 0) != pdTRUE) dropped++;
}

}  // namespace

bool startCsi(const uint8_t *routerMac) {
  memcpy(router, routerMac, 6);
  buildPositions();
  if (!queue) queue = xQueueCreate(QUEUE_LENGTH, sizeof(CsiBlock));
  if (!queue) return false;

  wifi_csi_config_t config;
  memset(&config, 0, sizeof(config));
  config.lltf_en = true;
  config.htltf_en = true;
  config.stbc_htltf2_en = true;
  config.ltf_merge_en = true;
  config.channel_filter_en = false;  // datos sin suavizar entre subportadoras
  config.manu_scale = false;

  return esp_wifi_set_csi_config(&config) == ESP_OK &&
         esp_wifi_set_csi_rx_cb(csiCallback, nullptr) == ESP_OK &&
         esp_wifi_set_csi(true) == ESP_OK;
}

bool startPingToGateway(uint32_t intervalMs) {
  const IPAddress gateway = WiFi.gatewayIP();
  esp_ping_config_t config;
  memset(&config, 0, sizeof(config));
  config.count = ESP_PING_COUNT_INFINITE;
  config.interval_ms = intervalMs;
  config.timeout_ms = 1000;
  config.data_size = 1;
  config.ttl = 64;
  IP_ADDR4(&config.target_addr, gateway[0], gateway[1], gateway[2], gateway[3]);
  config.task_stack_size = 4096;
  config.task_prio = 2;

  esp_ping_callbacks_t callbacks;
  memset(&callbacks, 0, sizeof(callbacks));  // no hace falta procesar las respuestas
  esp_ping_handle_t ping;
  return esp_ping_new_session(&config, &callbacks, &ping) == ESP_OK && esp_ping_start(ping) == ESP_OK;
}

bool takeCsiAmplitudes(float *amplitudes) {
  CsiBlock block;
  if (!queue || xQueueReceive(queue, &block, 0) != pdTRUE) return false;
  for (size_t i = 0; i < CSI_SUBCARRIERS; i++) {
    const int imag = block.data[2 * positions[i]];
    const int real = block.data[2 * positions[i] + 1];
    amplitudes[i] = sqrtf((float)(real * real + imag * imag));
  }
  return true;
}

CsiStats csiStats() {
  return {received, dropped, withoutHtLtf};
}
