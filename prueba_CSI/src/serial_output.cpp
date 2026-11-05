#include <math.h>

#include "serial_output.h"
#include "csi_layout.h"

void printMac(const uint8_t *m) {
  Serial.printf("%02x:%02x:%02x:%02x:%02x:%02x", m[0], m[1], m[2], m[3], m[4], m[5]);
}

void printCsvLine(const CsiPacket &p, uint32_t seq) {
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
    if (i + 1 < p.len) Serial.print(',');  // comas: compatible con las herramientas de esp-csi
  }
  Serial.println("]\"");
}

void printCsvHeader() {
  Serial.println(
      "# CSV: type,seq,mac,rssi,rate,sig_mode,mcs,cwb,smoothing,not_sounding,aggregation,"
      "stbc,fec_coding,sgi,noise_floor,ampdu_cnt,channel,secondary_channel,local_timestamp,"
      "ant,sig_len,rx_state,len,first_word_invalid,data");
  Serial.println("# data = [imag0,real0,imag1,real1,...] (int8, 2 bytes por subportadora)");
}

void dissect(const CsiPacket &p, const uint8_t routerMac[6]) {
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

void printHelp() {
  Serial.println("# Comandos: d=diseccionar un paquete  n=una linea CSV  c=CSV continuo on/off  s=estadisticas  h=ayuda");
}
