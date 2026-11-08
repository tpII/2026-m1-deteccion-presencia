# Guía de pruebas con hardware

## 1 Arranque común con un comando

Desde la raíz, ejecutar `./start.sh` en macOS/Linux o `.\start.bat` en Windows. El comando instala las herramientas faltantes que puede gestionar el sistema, crea configuración y dependencias, inicia Mosquitto si hace falta y levanta backend y frontend. Espera que respondan y abre http://localhost:5173. No hay que iniciar tres terminales para el uso habitual.

La primera ejecución necesita Internet y puede pedir permisos. Para alcance por sistema, caché, errores y broker remoto, ver [arranque](arranque.md). Los scripts no programan las placas ni completan credenciales Wi-Fi. PlatformIO se instala por separado cuando se necesita compilar o cargar firmware.

| Caso web | Hardware | Datos |
| --- | --- | --- |
| Caso 1 PIR | Sensor PIR y ESP32 con `firmware/pir/` | `sensores/pir/presencia` |
| Caso 2 CSI router | Router y ESP32 con `firmware/csi_router/` | `sensores/csi/amplitudes` |
| Caso 3 PIR + CSI | Los dos montajes anteriores encendidos | Mismas dos fuentes, estados y gráficos separados |

La pantalla PIR USB se retiró. El monitor Serial de PlatformIO sigue disponible. El contrato `csi_dedicated` del backend se conserva por compatibilidad; no es el Caso 3 actual.

## 2 Comprobar servicios y muestras

1. Abrir http://localhost:8000/api/v1/health: comprobar `mqtt_connected: true`.
2. Abrir http://localhost:5173: comprobar la conexión del navegador.
3. Encender las placas configuradas y comprobar que aumenta `total_samples` en http://localhost:8000/api/v1/telemetry/status.
4. Observar los gráficos de `/case/pir`, `/case/csi_router` o `/case/combined`.
5. Consultar `/api/v1/telemetry/pir/history` o `/api/v1/telemetry/csi_router/history` para comprobar persistencia.

LIVE solo verifica navegador y backend. MQTT conectado solo verifica backend y broker. La llegada de muestras debe comprobarse por caso. Un caso se marca desconectado tras 10 segundos sin muestras nuevas. La telemetría se guarda automáticamente por lotes aproximadamente cada 2 segundos.

## 3 Configurar las placas

Editar el archivo `include/config.h` de cada firmware y completar `WIFI_SSID`, `WIFI_PASSWORD` y `MQTT_HOST`. Este último debe ser la IP LAN de la computadora con Mosquitto, no `localhost`. En el `.env` del backend sí puede mantenerse `localhost` si el broker corre en la misma computadora.

La red debe permitir comunicación entre clientes. Revisar banda de 2,4 GHz, firewall y aislamiento de invitados. Para CSI, comprobar además formato HT-LTF y canal esperado; conectarse al router no prueba que las capturas sean utilizables por el analizador.

Los cambios del firmware o sus credenciales requieren recompilar y cargar. Una placa programada arranca al recibir alimentación y conserva su firmware al apagarla.

## 4 Caso 1 PIR

El montaje descrito en el proyecto usa HW-416-B con OUT a GPIO27 y masa común. La guía original conecta VCC a VIN/5 V; verificar alimentación y compatibilidad de salida del módulo físico antes de repetir el cableado. No generalizar el orden de pines o alimentación a cualquier PIR. Desconectar alimentación antes de cambiar cables.

Desde la raíz:

```bash
pio run --project-dir firmware/pir
pio run --project-dir firmware/pir --target upload
pio device monitor --project-dir firmware/pir --baud 115200
```

El entorno configurado es `upesy_wroom`; comprobar que corresponda a la placa utilizada. Cerrar otros monitores antes de cargar. Si hay varias placas, identificar el puerto con `pio device list` y agregar `--upload-port PUERTO` o `--port PUERTO` al comando correspondiente.

Con el servidor iniciado, abrir `/case/pir`. No hay que pulsar Conectar ESP32: las lecturas llegan por MQTT. El monitor muestra `MOVIMIENTO` o `SIN MOVIMIENTO` cada 500 ms nominales. Comprobar también el broker:

```bash
mosquitto_sub -h localhost -p 1883 -t sensores/pir/presencia -v
```

Una salida baja significa ausencia de movimiento detectado y no demuestra que no haya una persona quieta. La frecuencia de lectura no es una latencia medida. El firmware no calcula la latencia física y no reenvía muestras perdidas durante desconexiones.

## 5 Caso 2 CSI con router

Configurar y cargar `firmware/csi_router/`:

```bash
pio run --project-dir firmware/csi_router
pio run --project-dir firmware/csi_router --target upload
pio device monitor --project-dir firmware/csi_router --baud 115200
```

El entorno es `esp32doit-devkit-v1`. Comprobar Wi-Fi, IP, canal, MQTT y contadores. La placa genera ping al gateway cada 100 ms nominales, obtiene CSI de paquetes recibidos del router, calcula 55 amplitudes y publica JSON. El backend calcula los indicadores y decide presencia.

Abrir `/case/csi_router`, pulsar Calibrar, salir durante los 10 s de espera y mantener el ambiente vacío durante los 30 s de registro. Comprobar el mensaje completo y después probar vacío, caminando y sentado quieto. La calibración necesita al menos 50 paquetes y se pierde al reiniciar el backend.

```bash
mosquitto_sub -h localhost -p 1883 -t sensores/csi/amplitudes -v
```

Los resultados deben contrastarse con presencia observada independientemente. Una conexión exitosa o un gráfico que se mueve no demuestra exactitud.

## 6 Caso 3 PIR y CSI en conjunto

Abrir `/case/combined`, con las dos placas anteriores encendidas. El contador indica cuántas fuentes tienen lecturas. Cada sensor conserva estado y gráficos; no hay fusión de decisiones ni un tercer firmware o tópico. CSI comparte la calibración del Caso 2. Ver [procedimiento conjunto](prueba-conjunta.md).

Registrar resultados de PIR y CSI por separado en Sistema & Hardware. La comparación cuantitativa muestra esos dos métodos. El Caso 3 es la vista del ensayo simultáneo, no una tercera técnica de detección.

## 7 Captura CSI por Serial y análisis de logs

`prueba_CSI/` funciona sin web ni MQTT. Configurar `include/wifi_secrets.h` desde su ejemplo, con `WIFI_SSID` y `WIFI_PASS`, y cargar:

```bash
pio run --project-dir prueba_CSI
pio run --project-dir prueba_CSI --target upload
pio device monitor --project-dir prueba_CSI
```

El monitor trabaja a 921600 baud. Pulsar `c` sin Enter para activar CSV continuo y nuevamente para cerrar cada tramo; los filtros guardan un log. Registrar qué tramo corresponde a vacío, caminando y sentado. `s` muestra estadísticas, `h` ayuda y `d` explica el siguiente paquete.

Para análisis fuera de línea, instalar NumPy, pandas y matplotlib en el Python usado para esos scripts. Para reproducción MQTT se necesita NumPy y paho-mqtt. El arranque web no instala estas herramientas opcionales. Ver [captura y análisis](../prueba_CSI/README.md) y la [guía de la muestra](guia-completa-muestra.md).

## 8 Ejecución manual

El comando habitual ya inicia todo. Estas tres terminales se reservan para mantenimiento, con dependencias preparadas y sin otra instancia activa:

```bash
mosquitto -c mosquitto/mosquitto.conf -v
```

```bash
cd backend
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

En Windows, el ejecutable Python es `backend\.venv\Scripts\python.exe`; usar las rutas y separadores correspondientes. La vía recomendada sigue siendo `.\start.bat`.

## 9 Diagnóstico y mediciones

| Síntoma | Qué revisar |
| --- | --- |
| Descarga o permiso fallido | Internet y autorización del gestor; repetir el comando |
| Puerto 8000 o 5173 ocupado | Cerrar la instancia anterior sin detener procesos ajenos |
| Serial ilegible | PIR y CSI MQTT a 115200; prueba_CSI a 921600 |
| No conecta MQTT desde el ESP32 | IP LAN, puerto, firewall, aislamiento y escucha del broker |
| Hay Serial pero no datos en la web | Verificar tópico, JSON, `total_samples` y WebSocket |
| CSI siempre indica ausencia | Estado y mensaje de calibración; muestras y formato válido |
| Faltan paquetes | Contadores de cola llena, formato y velocidad de recepción |
| Web sin métricas | Registrar ensayos; telemetría no crea ground truth |

Definir el punto inicial y final de toda medición de latencia. Para PIR distinguir movimiento a salida física, salida a lectura, y movimiento a pantalla. No registrar cero como si fuera latencia medida. Documentar condiciones, posiciones, red y cambios de escenario.

## 10 Pruebas automáticas

Una vez preparado el entorno con el arranque, detener esa instancia si se necesitan sus puertos y seguir [pruebas-automaticas.md](pruebas-automaticas.md). Los tests usan bases temporales y publicaciones controladas, no prueban el rendimiento físico de las placas.
