# Firmware Caso 2 — CSI con router Wi-Fi

El ESP32 se conecta al router, le hace ping 10 veces por segundo y, por cada respuesta, calcula la amplitud de 55 subportadoras (campo HT-LTF) y la publica por MQTT en `presence/csi/router/raw`. El backend calcula los indicadores de movimiento y forma y decide si hay presencia (ver `docs/signal-processing.md`).

Iniciá el servidor y la web con `./start.sh` o `.\start.bat`; el comando prepara las dependencias y Mosquitto cuando faltan. La placa se configura y carga por separado.

## Cómo usarlo

1. Editar `include/config.h` y completar:
   - `WIFI_SSID` y `WIFI_PASSWORD`: red de **2,4 GHz** con clave WPA2 (no sirven redes con usuario o portal de login).
   - `MQTT_HOST`: IP de la computadora donde corren Mosquitto y el backend (en Windows: `ipconfig`, "Dirección IPv4"). La computadora y el ESP32 tienen que estar en la misma red.
2. Abrir esta carpeta (`firmware/csi_router`) en VS Code con PlatformIO, compilar y subir.
3. En el monitor serie (115200 baudios) cada 10 s aparece un resumen: paquetes CSI recibidos, publicados y estado de Wi-Fi y MQTT.
4. Abrir la página **Caso 2 — CSI + Router** de la web y presionar **Calibrar** con la habitación vacía.

`config.h` se incluye con valores genéricos. No subir las credenciales reales a Git.

## Sin la placa

`prueba_CSI/analisis/reproducir_log_mqtt.py` publica una grabación del monitor serie con el mismo formato, para probar el backend y la web sin hardware.

## Prueba conjunta

El Caso 3 (`/case/combined`) muestra esta misma fuente CSI junto con PIR. La calibración iniciada allí es la del Caso 2; no hay otra placa, tópico ni detector para el caso conjunto.
