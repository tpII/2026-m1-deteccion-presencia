#include <WiFi.h>
#include "ping/ping_sock.h"
#include "wifi_secrets.h"
#include "router_network.h"
#include "serial_output.h"

#ifndef PING_INTERVAL_MS
#define PING_INTERVAL_MS 100
#endif

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

bool connectWifi(uint8_t routerMac[6]) {
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
  Serial.printf("#   Canal ............. %ld\n", (long)WiFi.channel());
  Serial.printf("#   RSSI .............. %d dBm\n", WiFi.RSSI());
  return true;
}

// Cada respuesta del router genera un paquete con CSI.
bool startPing() {
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
