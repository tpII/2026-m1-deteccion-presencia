# Captura CSI del router por Serial

Este proyecto PlatformIO conecta un ESP32 al router y captura información CSI de sus paquetes Wi-Fi. Es una prueba separada de `firmware/pir/`: **no publica MQTT ni envía datos al dashboard**.

## Configuración y ejecución

- Placa configurada: `esp32doit-devkit-v1`, framework Arduino.
- Red: `WIFI_SSID` y `WIFI_PASS` en `include/wifi_secrets.h`. No copiar credenciales a informes ni mensajes de diagnóstico compartidos.
- Ping al router cada 100 ms, según `PING_INTERVAL_MS` de `platformio.ini`. Genera tráfico; no garantiza recibir exactamente 10 paquetes CSI por segundo.
- Por defecto sólo acepta paquetes de la MAC del router (`FILTER_ROUTER_ONLY=1`).
- Serial y carga configurados a 921600 baud. El firmware PIR utiliza 115200: son proyectos distintos.

Desde la raíz del repositorio:

```bash
pio run --project-dir prueba_CSI
pio run --project-dir prueba_CSI --target upload
pio device monitor --project-dir prueba_CSI
```

Estos comandos requieren PlatformIO y una configuración de red válida. Compilar no carga la placa; `--target upload` sí lo hace.

## Comandos del monitor

| Tecla, sin Enter | Acción |
| --- | --- |
| `d` | Explicar el próximo paquete: metadatos, segmentos, amplitud y fase de los pares. |
| `n` | Imprimir una línea CSV del próximo paquete. |
| `c` | Activar o desactivar las líneas CSV continuas. |
| `s` | Mostrar estadísticas. |
| `h` | Mostrar ayuda. |

La impresión CSV continua comienza desactivada. El primer paquete se muestra en modo de disección y se imprimen estadísticas aproximadamente cada 10 segundos. Los filtros del monitor agregan la hora de la computadora y guardan la salida en un archivo de registro; hay texto de diagnóstico además de los datos.

## Formato y límites

Cada línea de datos empieza con `CSI_DATA,` e incluye secuencia, MAC, metadatos de radio, marca de tiempo local, longitud, `first_word_invalid` y el vector de bytes `[imag0 real0 imag1 real1 ...]`.

El CSV conserva los bytes capturados. El modo de disección calcula amplitud y fase para mostrarlas, y marca los primeros cuatro bytes como inválidos cuando `first_word_invalid` es verdadero; no elimina esos bytes del CSV. La marca de tiempo de radio está en microsegundos locales, no es una fecha UTC. La cantidad de pares del buffer abarca sus segmentos; no debe presentarse automáticamente como cantidad de subportadoras útiles distintas.

El callback copia los paquetes en una cola de 16 entradas. El bucle los consume para mostrarlos; si la cola se llena, se descartan y aumenta el contador correspondiente. No hay persistencia SQLite ni reenvío al servidor en este proyecto.

## Análisis y visualización web

`analisis/analizar_csi.py` procesa logs después de grabarlos. `analisis/reproducir_log_mqtt.py` publica una grabación por MQTT respetando sus tiempos; esa reproducción no es captura del ambiente actual. Los requisitos del análisis son NumPy, pandas y matplotlib; la reproducción necesita NumPy y paho-mqtt.

Para una adquisición en vivo que publique directamente en el dashboard, cargar **`firmware/csi_router/`**, que calcula 55 amplitudes y las publica en `presence/csi/router/raw`. El backend usa todo el vector para calcular movimiento y forma; guarda la amplitud media por paquete.

La web se inicia con `./start.sh` o `.\start.bat`, que prepara las dependencias del servidor. El Caso 2 permite calibrar CSI; el Caso 3 lo muestra junto con PIR. Esta captura Serial sigue siendo independiente. Ver [guía completa](../docs/guia-completa-muestra.md) y [arranque](../docs/arranque.md).
