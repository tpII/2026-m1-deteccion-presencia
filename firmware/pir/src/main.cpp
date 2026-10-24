#include <Arduino.h>

#include "config.h"
#include "network.h"

unsigned long lastSample = 0;

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT_PULLDOWN);
  beginNetwork();
}

void loop() {
  maintainNetwork();
  const unsigned long now = millis();
  if (now - lastSample >= SAMPLE_INTERVAL_MS) {
    lastSample = now;
    const bool motion = digitalRead(PIR_PIN) == HIGH;
    Serial.println(motion ? "MOVIMIENTO" : "SIN MOVIMIENTO");
    publishPresence(motion);
  }
  delay(5);
}
