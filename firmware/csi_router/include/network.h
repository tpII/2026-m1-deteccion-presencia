#pragma once

#include <stddef.h>
#include <stdint.h>

void beginNetwork();
void maintainNetwork();
bool wifiConnected();
bool mqttConnected();
const uint8_t *routerMac();
bool publishAmplitudes(const float *amplitudes, size_t count);
