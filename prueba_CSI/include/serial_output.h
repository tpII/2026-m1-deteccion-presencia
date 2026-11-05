#pragma once

#include "csi_capture.h"

void printMac(const uint8_t *mac);
void printCsvLine(const CsiPacket &packet, uint32_t sequence);
void printCsvHeader();
void dissect(const CsiPacket &packet, const uint8_t routerMac[6]);
void printHelp();
