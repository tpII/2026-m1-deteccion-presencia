#pragma once

#include <stddef.h>
#include <stdint.h>

// Amplitudes por paquete: subportadoras -28..28 del campo HT-LTF, sin la 0 ni la 1
// (las mismas que se usaron en el análisis de prueba_CSI/analisis).
constexpr size_t CSI_SUBCARRIERS = 55;

struct CsiStats {
  uint32_t received;       // paquetes del router recibidos
  uint32_t dropped;        // descartados porque la cola estaba llena
  uint32_t withoutHtLtf;   // paquetes legacy (802.11b/g) sin campo HT-LTF
};

bool startCsi(const uint8_t *routerMac);
bool startPingToGateway(uint32_t intervalMs);
bool takeCsiAmplitudes(float *amplitudes);  // true si había un paquete pendiente
CsiStats csiStats();
