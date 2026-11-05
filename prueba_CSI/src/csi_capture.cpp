#include "csi_capture.h"

#ifndef FILTER_ROUTER_ONLY
#define FILTER_ROUTER_ONLY 1
#endif

static const int QUEUE_LEN = 16;
static QueueHandle_t csiQueue;
static uint8_t routerMac[6];
static volatile uint32_t pktCount = 0;
static volatile uint32_t dropCount = 0;
static volatile uint32_t otherCount = 0;

// La tarea Wi-Fi no imprime ni bloquea: sólo copia a la cola.
static void csiCallback(void *, wifi_csi_info_t *info) {
  if (!info || !info->buf || info->len == 0) return;
#if FILTER_ROUTER_ONLY
  if (memcmp(info->mac, routerMac, 6) != 0) {
    otherCount = otherCount + 1;
    return;
  }
#endif
  static CsiPacket pkt;  // estatico: el callback siempre corre en la misma tarea
  pkt.rx = info->rx_ctrl;
  memcpy(pkt.mac, info->mac, 6);
  pkt.firstWordInvalid = info->first_word_invalid;
  pkt.len = info->len > CSI_MAX_LEN ? CSI_MAX_LEN : info->len;
  memcpy(pkt.buf, info->buf, pkt.len);
  if (xQueueSend(csiQueue, &pkt, 0) == pdTRUE) {
    pktCount = pktCount + 1;
  } else {
    dropCount = dropCount + 1;
  }
}

bool startCsi(const uint8_t router[6]) {
  csiQueue = xQueueCreate(QUEUE_LEN, sizeof(CsiPacket));
  if (!csiQueue) {
    Serial.println("# ERROR: sin memoria para la cola");
    return false;
  }
  memcpy(routerMac, router, 6);
  wifi_csi_config_t cfg;
  memset(&cfg, 0, sizeof(cfg));
  cfg.lltf_en = true;            // campo legacy (presente en todos los paquetes OFDM)
  cfg.htltf_en = true;           // campo HT (paquetes 802.11n)
  cfg.stbc_htltf2_en = true;     // segundo HT-LTF cuando el paquete usa STBC
  cfg.ltf_merge_en = true;       // promedia LLTF y HT-LTF en paquetes HT (valor por defecto)
  cfg.channel_filter_en = false; // sin suavizado entre subportadoras: datos crudos
  cfg.manu_scale = false;        // escala automatica
  cfg.shift = 0;

  esp_err_t err;
  if ((err = esp_wifi_set_csi_config(&cfg)) != ESP_OK) {
    Serial.printf("# ERROR esp_wifi_set_csi_config: %s\n", esp_err_to_name(err));
    return false;
  }
  if ((err = esp_wifi_set_csi_rx_cb(csiCallback, nullptr)) != ESP_OK) {
    Serial.printf("# ERROR esp_wifi_set_csi_rx_cb: %s\n", esp_err_to_name(err));
    return false;
  }
  if ((err = esp_wifi_set_csi(true)) != ESP_OK) {
    Serial.printf("# ERROR esp_wifi_set_csi: %s\n", esp_err_to_name(err));
    return false;
  }
  Serial.println("# Captura de CSI activada.");
  return true;
}

bool readCsiPacket(CsiPacket &packet) {
  return xQueueReceive(csiQueue, &packet, pdMS_TO_TICKS(50)) == pdTRUE;
}

CaptureStats captureStats() {
  return {pktCount, dropCount, otherCount};
}
