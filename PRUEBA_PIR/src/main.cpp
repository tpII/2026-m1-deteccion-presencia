#include <Arduino.h>

const int PIR_PIN = 27; // Conexion del sensor PIR al pin GPIO 27 del ESP32

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT_PULLDOWN);
  Serial.println("Estabilizando sensor PIR...");
  delay(15000); 
  Serial.println("--- SENSOR LISTO ---");
}

void loop() {
  int estadoPIR = digitalRead(PIR_PIN);
  if (estadoPIR == HIGH) {
    Serial.println("[ ALERTA ] Movimiento detectado");
  } else {
    Serial.println("[ OK ] Sin movimiento");
  }
  delay(500);
}