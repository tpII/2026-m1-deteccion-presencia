#include "csi_layout.h"

int csiLayout(const wifi_pkt_rx_ctrl_t &rx, Segment out[3]) {
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
const char *subcarrierRole(const char *seg, int k, uint8_t sec) {
  if (sec != 0) return "-";
  const int limit = (seg[0] == 'L') ? 26 : 28;  // LLTF: 802.11a/g; HT-LTF: 802.11n 20 MHz
  if (k == 0) return "nula (DC)";
  if (k > limit || k < -limit) return "nula (guarda)";
  if (k == 7 || k == -7 || k == 21 || k == -21) return "piloto";
  return "datos";
}
