# PIR con PlatformIO

Basado en [`PRUEBA_PIR` de Bernardo](https://github.com/tpII/2026-m1-deteccion-presencia/tree/24b41a0578bcf6454eb212ca0f74b04cb2523ae6/PRUEBA_PIR). Conserva GPIO27 con `INPUT_PULLDOWN`, Serial a 115200 baud y lectura cada 500 ms nominales. Se agregó publicación MQTT del mismo estado para el dashboard.

| Archivo | Responsabilidad |
| --- | --- |
| `platformio.ini` | Placa `upesy_wroom`, plataforma ESP32 y PubSubClient. |
| `src/main.cpp` | Lectura del PIR y salida Serial. |
| `src/network.cpp` | Conexión Wi-Fi, reconexión y publicación MQTT. |
| `include/config.example.h` | Ejemplo de red, broker, pin e intervalos. |
| `include/config.h` | Configuración local, excluida de Git. |

## Preparar y compilar

Instalá PlatformIO IDE en VS Code y abrí esta carpeta como proyecto, o usá PlatformIO Core. Copiá `include/config.example.h` como `include/config.h` y completá Wi-Fi de 2.4 GHz e IP LAN del broker.

Desde la raíz del repositorio:

```bash
cp -n firmware/pir/include/config.example.h firmware/pir/include/config.h
pio run --project-dir firmware/pir
```

En Windows, copiá y renombrá el archivo desde VS Code. No hace falta instalar bibliotecas a mano ni usar Arduino IDE. El proyecto usa el framework Arduino de ESP32 dentro de PlatformIO.

## Cargar y comprobar

Conectá la placa y cerrá cualquier monitor serial o conexión USB de la web:

```bash
pio device list
pio run --project-dir firmware/pir --target upload
pio device monitor --project-dir firmware/pir --baud 115200
```

PlatformIO detecta el puerto. Para elegir uno, agregá `--upload-port PUERTO` al comando de carga o `--port PUERTO` al monitor. No se fija `COM9` en el repositorio. La placa configurada es la misma que usaba Bernardo; para otro modelo, ajustá `board` en `platformio.ini`.

Con `./start.sh` activo, las muestras llegan a `/case/pir` por MQTT. El tópico sigue siendo `presence/pir/telemetry`. Los mensajes `MOVIMIENTO` y `SIN MOVIMIENTO` también funcionan en `/test/pir-usb`; cerrá el monitor de PlatformIO para liberar el puerto antes de usar esa página.

Sin Wi-Fi o broker, el firmware sigue mostrando lecturas por Serial y reintenta la conexión. Las muestras desconectadas no se almacenan ni se reenvían. El intervalo de 500 ms es nominal: los intentos de conexión pueden demorar la lectura. No se inventa una latencia física; el backend conserva el valor por defecto de cero.

Cableado, adquisición y registro de ensayos: [guía de pruebas](../../docs/pruebas.md).
