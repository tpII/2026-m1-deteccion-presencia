/*
 * Caso 2 - Primer paso: captura de CSI (Channel State Information) desde el router
 *
 * Que hace:
 *  1. Conecta el ESP32 como estacion (cliente) a la red Wi-Fi del router.
 *  2. Activa la captura de CSI: por cada paquete que recibe, el chip Wi-Fi entrega
 *     la respuesta en frecuencia del canal para cada subportadora OFDM.
 *  3. Hace ping al router 10 veces por segundo para que el router le envie
 *     paquetes de forma constante (sin trafico no hay CSI).
 *  4. Imprime cada paquete por el puerto serie en una linea CSV (CSI_DATA,...)
 *     y, a pedido, una "diseccion" detallada de un paquete con todas sus partes.
 *
 * Comandos por el monitor serie (tipear la letra, sin Enter):
 *   d = diseccionar el proximo paquete (encabezado + tabla de subportadoras)
 *   n = imprimir UNA sola linea CSV (el proximo paquete)
 *   c = activar/desactivar la impresion continua de lineas CSV (para grabar datos)
 *   s = estadisticas (paquetes/s, descartados)
 *   h = ayuda
 *
 * Referencia del formato: ESP-IDF v4.4, "Wi-Fi Channel State Information".
 */

#include <Arduino.h>
#include <WiFi.h>
#include <math.h>
#include "esp_wifi.h"
#include "ping/ping_sock.h"
#include "wifi_secrets.h"

#ifndef PING_INTERVAL_MS
#define PING_INTERVAL_MS 100
#endif
#ifndef FILTER_ROUTER_ONLY
#define FILTER_ROUTER_ONLY 1
#endif

static const size_t CSI_MAX_LEN = 612;  // maximo posible en ESP32 (HT40 + STBC)
static const int QUEUE_LEN = 16;

// Copia de un paquete CSI. El callback corre en la tarea Wi-Fi y debe ser rapido:
// solo copia los datos a una cola, y loop() los imprime.
struct CsiPacket {
  wifi_pkt_rx_ctrl_t rx;  // encabezado de radio (RSSI, modo, canal, etc.)
  uint8_t mac[6];         // MAC de quien envio el paquete
  bool firstWordInvalid;  // los primeros 4 bytes pueden ser invalidos (limitacion del ESP32)
  uint16_t len;           // cantidad de bytes de CSI
  int8_t buf[CSI_MAX_LEN];
};

static QueueHandle_t csiQueue;
static uint8_t routerMac[6];
static volatile uint32_t pktCount = 0;    // paquetes encolados
static volatile uint32_t dropCount = 0;   // paquetes descartados por cola llena
static volatile uint32_t otherCount = 0;  // paquetes de otras MAC (filtrados)
static bool printCsv = false;  // arranca en silencio: activar con 'c' para grabar
static bool printOne = false;  // 'n': imprimir un solo paquete
static bool dissectNext = true;  // disecciona el primer paquete automaticamente
static uint32_t seq = 0;

// ---------------------------------------------------------------------------
// Callback CSI (tarea Wi-Fi): copiar y salir
// ---------------------------------------------------------------------------
static void csiCallback(void *ctx, wifi_csi_info_t *info) {
  if (!info || !info->buf || info->len == 0) return;
#if FILTER_ROUTER_ONLY
  if (memcmp(info->mac, routerMac, 6) != 0) {
    otherCount++;
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
    pktCount++;
  } else {
    dropCount++;
  }
}

// ---------------------------------------------------------------------------
// Estructura del buffer segun la tabla de Espressif
// Cada campo (LTF) es una lista de subportadoras: primero los indices 0..pos-1,
// despues los negativos -neg..-1. Cada subportadora ocupa 2 bytes: [imag, real].
// ---------------------------------------------------------------------------
struct Segment {
  const char *name;
  uint8_t pos;  // cantidad de indices positivos (empiezan en 0)
  uint8_t neg;  // cantidad de indices negativos (terminan en -1)
};

// Devuelve la cantidad de segmentos y los carga en 'out' (maximo 3).
static int csiLayout(const wifi_pkt_rx_ctrl_t &rx, Segment out[3]) {
  const bool ht = rx.sig_mode != 0;  // 0 = 802.11b/g (legacy); 1 = 802.11n (HT)
  const bool ht40 = rx.cwb == 1;
  const bool stbc = rx.stbc != 0;
  const uint8_t sec = rx.secondary_channel;  // 0 = ninguno, 1 = arriba, 2 = abajo

  if (sec == 0) {  // canal de 20 MHz (caso mas comun en 2,4 GHz)
    out[0] = {"LLTF", 32, 32};
    if (!ht) return 1;
    out[1] = {"HT-LTF", 32, 32};
    if (!stbc) return 2;
    out[2] = {"STBC-HT-LTF", 32, 32};
    return 3;
  }
  const bool below = sec == 2;
  out[0] = below ? Segment{"LLTF", 64, 0} : Segment{"LLTF", 0, 64};
  if (!ht) return 1;
  if (!ht40) {
    if (!stbc) {
      out[1] = below ? Segment{"HT-LTF", 64, 0} : Segment{"HT-LTF", 0, 64};
      return 2;
    }
    out[1] = below ? Segment{"HT-LTF", 63, 0} : Segment{"HT-LTF", 0, 62};
    out[2] = below ? Segment{"STBC-HT-LTF", 63, 0} : Segment{"STBC-HT-LTF", 0, 62};
    return 3;
  }
  if (!stbc) {
    out[1] = {"HT-LTF", 64, 64};
    return 2;
  }
  out[1] = {"HT-LTF", 61, 60};
  out[2] = {"STBC-HT-LTF", 61, 60};
  return 3;
}

// Clasifica una subportadora (solo para canal de 20 MHz sin canal secundario).
static const char *subcarrierRole(const char *seg, int k, uint8_t sec) {
  if (sec != 0) return "-";
  const int limit = (seg[0] == 'L') ? 26 : 28;  // LLTF: 802.11a/g; HT-LTF: 802.11n 20 MHz
  if (k == 0) return "nula (DC)";
  if (k > limit || k < -limit) return "nula (guarda)";
  if (k == 7 || k == -7 || k == 21 || k == -21) return "piloto";
  return "datos";
}

// ---------------------------------------------------------------------------
// Salida por serie
// ---------------------------------------------------------------------------
static void printMac(const uint8_t *m) {
  Serial.printf("%02x:%02x:%02x:%02x:%02x:%02x", m[0], m[1], m[2], m[3], m[4], m[5]);
}

static void printCsvLine(const CsiPacket &p) {
  const wifi_pkt_rx_ctrl_t &r = p.rx;
  Serial.printf("CSI_DATA,%lu,", (unsigned long)seq);
  printMac(p.mac);
  Serial.printf(",%d,%u,%u,%u,%u,%u,%u,%u,%u,%u,%u,%d,%u,%u,%u,%lu,%u,%u,%u,%u,%u,\"[",
                r.rssi, r.rate, r.sig_mode, r.mcs, r.cwb, r.smoothing, r.not_sounding,
                r.aggregation, r.stbc, r.fec_coding, r.sgi, r.noise_floor, r.ampdu_cnt,
                r.channel, r.secondary_channel, (unsigned long)r.timestamp, r.ant, r.sig_len,
                r.rx_state, p.len, p.firstWordInvalid);
  for (uint16_t i = 0; i < p.len; i++) {
    Serial.print((int)p.buf[i]);  // int8_t se imprimiria como caracter
    if (i + 1 < p.len) Serial.print(' ');
  }
  Serial.println("]\"");
}

static void printCsvHeader() {
  Serial.println(
      "# CSV: type,seq,mac,rssi,rate,sig_mode,mcs,cwb,smoothing,not_sounding,aggregation,"
      "stbc,fec_coding,sgi,noise_floor,ampdu_cnt,channel,secondary_channel,local_timestamp,"
      "ant,sig_len,rx_state,len,first_word_invalid,data");
  Serial.println("# data = [imag0 real0 imag1 real1 ...] (int8, 2 bytes por subportadora)");
}

static void dissect(const CsiPacket &p) {
  const wifi_pkt_rx_ctrl_t &r = p.rx;
  Serial.println();
  Serial.println("################ DISECCION DE UN PAQUETE CSI ################");
  Serial.println("## 1) Metadatos (wifi_csi_info_t + encabezado de radio rx_ctrl)");
  Serial.print("   MAC origen ............ "); printMac(p.mac);
  Serial.println(memcmp(p.mac, routerMac, 6) == 0 ? "  (router)" : "");
  Serial.printf("   RSSI .................. %d dBm\n", r.rssi);
  Serial.printf("   Piso de ruido ......... %d dBm\n", r.noise_floor);
  Serial.printf("   Modo de senal ......... %u (%s)\n", r.sig_mode,
                r.sig_mode == 0 ? "802.11b/g, legacy" : r.sig_mode == 1 ? "802.11n, HT" : "otro");
  Serial.printf("   MCS / tasa ............ mcs=%u, rate=%u\n", r.mcs, r.rate);
  Serial.printf("   Ancho de canal (cwb) .. %s\n", r.cwb ? "40 MHz" : "20 MHz");
  Serial.printf("   Canal primario ........ %u\n", r.channel);
  Serial.printf("   Canal secundario ...... %u (%s)\n", r.secondary_channel,
                r.secondary_channel == 0 ? "ninguno" : r.secondary_channel == 1 ? "arriba" : "abajo");
  Serial.printf("   STBC .................. %u\n", r.stbc);
  Serial.printf("   Intervalo de guarda ... %s\n", r.sgi ? "corto" : "largo");
  Serial.printf("   Marca de tiempo ....... %lu us desde el arranque\n", (unsigned long)r.timestamp);
  Serial.printf("   Largo del paquete ..... %u bytes (sig_len)\n", r.sig_len);
  Serial.printf("   Estado de recepcion ... %u (0 = sin error)\n", r.rx_state);
  Serial.printf("   Largo del CSI (len) ... %u bytes = %u subportadoras\n", p.len, p.len / 2);
  Serial.printf("   first_word_invalid .... %s\n", p.firstWordInvalid ? "SI (primeras 2 subportadoras invalidas)" : "no");

  Segment segs[3];
  const int nSegs = csiLayout(r, segs);
  int expected = 0;
  for (int s = 0; s < nSegs; s++) expected += 2 * (segs[s].pos + segs[s].neg);

  Serial.println("## 2) Estructura del buffer de CSI");
  for (int s = 0; s < nSegs; s++) {
    Serial.printf("   %-12s %3u subportadoras (indices ", segs[s].name, segs[s].pos + segs[s].neg);
    if (segs[s].pos) Serial.printf("0..%d", segs[s].pos - 1);
    if (segs[s].pos && segs[s].neg) Serial.print(", ");
    if (segs[s].neg) Serial.printf("-%d..-1", segs[s].neg);
    Serial.println(")");
  }
  Serial.printf("   Bytes esperados segun tabla: %d | recibidos: %u%s\n", expected, p.len,
                expected == p.len ? "  OK" : "  (NO coinciden: se muestra igual)");

  Serial.println("## 3) Subportadoras: H(k) = real + j*imag");
  Serial.println("   byte | campo        |   k  | imag | real | amplitud | fase(rad) | tipo");
  int byteIdx = 0;
  for (int s = 0; s < nSegs && byteIdx + 1 < p.len; s++) {
    const int n = segs[s].pos + segs[s].neg;
    for (int i = 0; i < n && byteIdx + 1 < p.len; i++, byteIdx += 2) {
      const int k = (i < segs[s].pos) ? i : i - n;  // positivos primero, luego -neg..-1
      const int im = p.buf[byteIdx];
      const int re = p.buf[byteIdx + 1];
      const float amp = sqrtf((float)(re * re + im * im));
      const float ph = atan2f((float)im, (float)re);
      const char *role = (p.firstWordInvalid && byteIdx < 4) ? "invalida (hw)"
                                                             : subcarrierRole(segs[s].name, k, r.secondary_channel);
      Serial.printf("   %4d | %-12s | %4d | %4d | %4d | %8.2f | %9.3f | %s\n",
                    byteIdx, segs[s].name, k, im, re, amp, ph, role);
    }
  }
  Serial.println("################ FIN DE LA DISECCION ################");
  Serial.println();
}

static void printHelp() {
  Serial.println("# Comandos: d=diseccionar un paquete  n=una linea CSV  c=CSV continuo on/off  s=estadisticas  h=ayuda");
}

static void printStats() {
  static uint32_t lastCount = 0, lastMs = 0;
  const uint32_t now = millis();
  const float rate = lastMs ? 1000.0f * (pktCount - lastCount) / (now - lastMs) : 0;
  lastCount = pktCount;
  lastMs = now;
  Serial.printf("# Paquetes CSI: %lu | ~%.1f paquetes/s | descartados (cola llena): %lu | de otras MAC: %lu | RSSI router: %d dBm\n",
                (unsigned long)pktCount, rate, (unsigned long)dropCount, (unsigned long)otherCount, WiFi.RSSI());
}

// ---------------------------------------------------------------------------
// Wi-Fi, CSI y ping
// ---------------------------------------------------------------------------
static const char *wifiStatusText(wl_status_t s) {
  switch (s) {
    case WL_NO_SSID_AVAIL: return "no se encuentra la red (nombre mal escrito o red de 5 GHz)";
    case WL_CONNECT_FAILED: return "fallo la conexion (clave incorrecta?)";
    case WL_CONNECTION_LOST: return "conexion perdida";
    case WL_DISCONNECTED: return "desconectado";
    case WL_IDLE_STATUS: return "inactivo";
    default: return "otro";
  }
}

static const char *authText(wifi_auth_mode_t a) {
  switch (a) {
    case WIFI_AUTH_OPEN: return "abierta";
    case WIFI_AUTH_WEP: return "WEP";
    case WIFI_AUTH_WPA_PSK: return "WPA";
    case WIFI_AUTH_WPA2_PSK: return "WPA2";
    case WIFI_AUTH_WPA_WPA2_PSK: return "WPA/WPA2";
    case WIFI_AUTH_WPA2_ENTERPRISE: return "WPA2-Enterprise (NO soportada aca)";
    case WIFI_AUTH_WPA3_PSK: return "WPA3";
    case WIFI_AUTH_WPA2_WPA3_PSK: return "WPA2/WPA3";
    default: return "otra";
  }
}

// Motivo de desconexion que informa el chip (codigos de esp_wifi_types.h)
static volatile uint8_t lastReason = 0;
static const char *reasonText(uint8_t r) {
  switch (r) {
    case 2: return "AUTH_EXPIRE: la autenticacion expiro";
    case 4: return "ASSOC_EXPIRE: el router no respondio a tiempo";
    case 8: return "ASSOC_LEAVE";
    case 15: return "4WAY_HANDSHAKE_TIMEOUT: casi siempre CLAVE INCORRECTA";
    case 23: return "802_1X_AUTH_FAILED: red con usuario (Enterprise)";
    case 200: return "BEACON_TIMEOUT: senal debil o perdida";
    case 201: return "NO_AP_FOUND: no encuentra la red (nombre o modo de seguridad)";
    case 202: return "AUTH_FAIL: el router rechazo la autenticacion";
    case 203: return "ASSOC_FAIL: el router rechazo la asociacion (filtro MAC? limite de clientes?)";
    case 204: return "HANDSHAKE_TIMEOUT: casi siempre CLAVE INCORRECTA";
    case 205: return "CONNECTION_FAIL";
    default: return "ver tabla WIFI_REASON_* en esp_wifi_types.h";
  }
}

// Lista las redes visibles: confirma que la red existe, su canal, senal y seguridad.
static void scanNetworks() {
  Serial.println("# Buscando redes...");
  const int n = WiFi.scanNetworks();
  bool found = false;
  for (int i = 0; i < n; i++) {
    const bool match = WiFi.SSID(i) == WIFI_SSID;
    found |= match;
    Serial.printf("#  %s %-32s canal %2ld  %4ld dBm  %s\n", match ? "->" : "  ", WiFi.SSID(i).c_str(),
                  (long)WiFi.channel(i), (long)WiFi.RSSI(i), authText(WiFi.encryptionType(i)));
  }
  if (!found) {
    Serial.printf("# ATENCION: \"%s\" no aparece en la lista (revisar nombre exacto, mayusculas, espacios).\n", WIFI_SSID);
  }
  WiFi.scanDelete();
}

static bool connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true, true);  // borra configuraciones guardadas de pruebas anteriores
  delay(200);
  WiFi.setSleep(false);  // sin ahorro de energia: recepcion continua y timestamps precisos
  WiFi.onEvent([](WiFiEvent_t, WiFiEventInfo_t info) { lastReason = info.wifi_sta_disconnected.reason; },
               ARDUINO_EVENT_WIFI_STA_DISCONNECTED);

  scanNetworks();
  // Largos (no la clave): detecta espacios de mas o caracteres perdidos al copiar.
  Serial.printf("# SSID: %u caracteres | clave: %u caracteres\n", (unsigned)strlen(WIFI_SSID),
                (unsigned)strlen(WIFI_PASS));
  Serial.printf("# Conectando a \"%s\" ", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  const uint32_t t0 = millis();
  uint8_t shownReason = 0;
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 30000) {
    delay(500);
    Serial.print('.');
    if (lastReason && lastReason != shownReason) {  // informa cada motivo nuevo
      shownReason = lastReason;
      Serial.printf("\n# Desconexion, motivo %u: %s\n# Reintentando ", lastReason, reasonText(lastReason));
    }
  }
  Serial.println();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.printf("# ERROR: no se pudo conectar: %s", wifiStatusText(WiFi.status()));
    if (lastReason) Serial.printf(" | ultimo motivo %u: %s", lastReason, reasonText(lastReason));
    Serial.println();
    return false;
  }
  memcpy(routerMac, WiFi.BSSID(), 6);
  Serial.println("# Conectado.");
  Serial.print("#   IP del ESP32 ...... "); Serial.println(WiFi.localIP());
  Serial.print("#   IP del router ..... "); Serial.println(WiFi.gatewayIP());
  Serial.print("#   MAC del router .... "); printMac(routerMac); Serial.println();
  Serial.printf("#   Canal ............. %d\n", WiFi.channel());
  Serial.printf("#   RSSI .............. %d dBm\n", WiFi.RSSI());
  return true;
}

static bool startCsi() {
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

// Ping continuo al router: cada respuesta es un paquete del router que genera CSI.
static bool startPing() {
  const IPAddress gw = WiFi.gatewayIP();
  esp_ping_config_t cfg;
  memset(&cfg, 0, sizeof(cfg));
  cfg.count = ESP_PING_COUNT_INFINITE;
  cfg.interval_ms = PING_INTERVAL_MS;
  cfg.timeout_ms = 1000;
  cfg.data_size = 1;
  cfg.tos = 0;
  cfg.ttl = 64;
  IP_ADDR4(&cfg.target_addr, gw[0], gw[1], gw[2], gw[3]);
  cfg.task_stack_size = 4096;
  cfg.task_prio = 2;
  cfg.interface = 0;

  esp_ping_callbacks_t cbs;
  memset(&cbs, 0, sizeof(cbs));  // sin callbacks: solo nos interesa el trafico

  esp_ping_handle_t ping;
  if (esp_ping_new_session(&cfg, &cbs, &ping) != ESP_OK || esp_ping_start(ping) != ESP_OK) {
    Serial.println("# ERROR: no se pudo iniciar el ping al router");
    return false;
  }
  Serial.printf("# Ping al router cada %d ms para generar trafico.\n", PING_INTERVAL_MS);
  return true;
}

// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(921600);
  delay(500);
  Serial.println();
  Serial.println("# ===== Caso 2 - Captura de CSI desde el router =====");

  csiQueue = xQueueCreate(QUEUE_LEN, sizeof(CsiPacket));
  if (!csiQueue) {
    Serial.println("# ERROR: sin memoria para la cola");
    while (true) delay(1000);
  }

  if (!connectWifi()) {
    Serial.println("# Revisa WIFI_SSID / WIFI_PASS en include/wifi_secrets.h. Reiniciando en 10 s...");
    delay(10000);
    ESP.restart();
  }
  if (!startCsi()) {
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

  if (xQueueReceive(csiQueue, &pkt, pdMS_TO_TICKS(50)) == pdTRUE) {
    seq++;
    if (dissectNext) {
      dissectNext = false;
      dissect(pkt);
    }
    if (printCsv || printOne) {
      printOne = false;
      printCsvLine(pkt);
    }
  }

  // Estadisticas automaticas cada 10 s (tambien avisan si no llega nada)
  if (millis() - lastStats >= 10000) {
    lastStats = millis();
    printStats();
  }
}