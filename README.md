# Detección de presencia mediante PIR y CSI Wi-Fi

Proyecto universitario de Ingeniería — Taller de Proyecto II 2026, Grupo M1.

El proyecto compara tres métodos: sensor PIR, CSI recibido desde un router comercial y CSI en un enlace dedicado entre dos ESP32.
Este README es la guía para instalar, iniciar y comprobar cada caso. Los comandos se ejecutan desde la raíz del repositorio, salvo que se indique otra carpeta.

## 1. Pruebas con hardware

Todas las pruebas experimentales utilizan dispositivos físicos. La web espera las lecturas de los ESP32; no genera señales ni precarga resultados.

| Caso | Hardware | Estado y vista |
| --- | --- | --- |
| 1 — PIR por MQTT | ESP32, PIR HW-416-B y Wi-Fi de 2.4 GHz | Firmware incluido. Vista `/case/pir`; guía en sección 4 |
| 2 — CSI con router | ESP32 receptor y router comercial | Backend y vista `/case/csi_router` disponibles; falta firmware de captura CSI |
| 3 — CSI dedicado | Dos ESP32, emisor AP y receptor Station | Backend y vista `/case/csi_dedicated` disponibles; faltan firmware de ambos nodos |
| Diagnóstico PIR por USB | ESP32 y PIR con firmware que emite mensajes Serial | Vista `/test/pir-usb`; guía en sección 7 |

El comando común es **`./start.sh`**. Los tres casos pueden adquirir datos simultáneamente cuando sus nodos estén programados y conectados.

**Para cumplir la arquitectura del informe, la prueba física del Caso 1 debe usar MQTT.** USB sirve para programar y alimentar la placa, y opcionalmente para diagnosticarla. Arduino IDE puede cerrarse después de cargar el firmware.

```text
PIR / captura CSI → ESP32 → Wi-Fi / MQTT → Mosquitto
                                               ↓
                                    FastAPI: validación y procesamiento
                                               ↓
                                      SQLite + REST / WebSocket
                                               ↓
                                          React dashboard
```

La web recibe el flujo MQTT a través de FastAPI. El WebSocket de React es `/ws/telemetry`; no se conecta directamente al broker.

## 2. Instalación inicial (una sola vez)

Requisitos: Python 3.12+, Node.js 20+, npm y Git. Para MQTT necesitás Mosquitto. Para programar la ESP32 necesitás Arduino IDE con soporte ESP32.
`start.sh` usa Bash y funciona en macOS/Linux; en Windows podés usar WSL para el servidor o seguir la ejecución manual de la sección 8.

### Backend y frontend

```bash
# Crear la configuración si todavía no existe; no sobrescribir una .env propia.
cp -n .env.example .env
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
cd frontend
npm ci
cd ..
```

El backend lee `.env` de la raíz independientemente de la carpeta desde la que arranque.
Por compatibilidad, si existe `backend/.env`, sus valores tienen prioridad sobre los de la raíz. Las variables exportadas en la terminal tienen prioridad sobre ambos archivos.
Los valores del frontend por defecto apuntan a `http://localhost:8000` y `ws://localhost:8000/ws/telemetry`; para cambiarlos, usá `frontend/.env.local` con `VITE_API_URL` y `VITE_WS_URL`.
`start.sh` utiliza MQTT y también acepta `./start.sh mqtt`. Para el inicio manual o Docker,
configurá `DATA_SOURCE=mqtt` en `.env`; no se admiten otras fuentes.
La base nueva por defecto es `backend/presence-hardware.db`. Si venís de una configuración anterior,
actualizá `DATABASE_URL=sqlite+aiosqlite:///./presence-hardware.db` tanto en `.env` como en `backend/.env` si existe.
Las bases anteriores se conservan. Usá la nueva base para que las mediciones actuales no se mezclen con registros de demostración antiguos.

### Mosquitto

En macOS con Homebrew:

```bash
brew install mosquitto
```

En Ubuntu/Debian:

```bash
sudo apt update
sudo apt install mosquitto mosquitto-clients
```

No hace falta iniciar un servicio permanente: `start.sh` levanta el broker local si el puerto 1883 está libre. Si ya hay un broker, lo reutiliza.
La configuración nativa es `infrastructure/mosquitto/mosquitto.local.conf`; permite conexiones de la ESP32 desde la red local y no depende de rutas de Docker.
El broker de laboratorio permite conexiones sin contraseña. Usalo en una red de laboratorio; no publiques el puerto 1883 en Internet.

### Arduino IDE y bibliotecas del Caso 1

1. Instalá [Arduino IDE](https://www.arduino.cc/en/software/).
2. Abrí **Arduino IDE → Settings / Preferences** (`⌘ + ,` en macOS).
3. Agregá esta dirección en **Additional Boards Manager URLs**:
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`.
4. Abrí **Tools → Board → Boards Manager**, buscá `esp32` e instalá **esp32 by Espressif Systems**.
5. Abrí **Tools → Manage Libraries**, buscá `PubSubClient` e instalá **PubSubClient by Nick O’Leary**, versión 2.8.

WiFi viene con el soporte ESP32. PubSubClient es la única biblioteca adicional del firmware: implementa MQTT; no se agregó ninguna dependencia al frontend ni al backend.
Fuentes: [instalación ESP32](https://docs.espressif.com/projects/arduino-esp32/en/latest/installing.html), [PubSubClient](https://github.com/knolleary/pubsubclient).

## 3. Inicio común y comprobación de adquisición

Desde la raíz, ejecutá:

```bash
./start.sh
```

1. Abrí **http://localhost:5173**. El encabezado debe indicar **MQTT** y el WebSocket pasar a **LIVE**.
2. En **http://localhost:8000/api/v1/health**, comprobá `data_source: "mqtt"` y `mqtt_connected: true`.
3. Programá y encendé los nodos siguiendo las secciones de cada caso.
4. En **http://localhost:8000/api/v1/telemetry/status**, comprobá que aumente `total_samples` de cada nodo conectado.
5. Consultá su historial en `/api/v1/telemetry/pir/history`, `/api/v1/telemetry/csi_router/history` o `/api/v1/telemetry/csi_dedicated/history`.

Antes de recibir datos, los casos muestran **SIN LECTURA** y las métricas **Sin ensayos**.
LIVE confirma la conexión entre navegador y backend; el hardware se considera conectado si envió una muestra en los últimos 10 segundos.
El backend guarda la telemetría automáticamente en SQLite por lotes, aproximadamente cada dos segundos.

Para detener los servicios, pulsá **Ctrl+C**. Para reiniciar, ejecutá otra vez `./start.sh`.
La ESP32 conserva su firmware y sigue ejecutándolo mientras esté alimentada. Arduino IDE se necesita para cargar o modificar el programa.

## 4. Caso 1: PIR físico → ESP32 → MQTT → página web

### A. Cableado

Desconectá el USB antes de modificar conexiones. Identificá las etiquetas del sensor; no asumas el orden de los pines por el color de los cables.

| Sensor PIR HW-416-B | ESP32-WROOM-32 |
| --- | --- |
| VCC | VIN / 5V |
| GND | GND |
| OUT | D27 / GPIO27 |

Alimentá la ESP32 por USB. Apoyá las placas sobre una superficie aislante, sin contactos metálicos debajo de los pines.

### B. Preparar el firmware y el Wi-Fi

El programa está en **`firmware/pir_mqtt/pir_mqtt.ino`**.

```bash
cp -n firmware/pir_mqtt/config.example.h firmware/pir_mqtt/config.h
```

Abrí `config.h` y completá:

```cpp
const char WIFI_SSID[] = "nombre_de_tu_red";
const char WIFI_PASSWORD[] = "clave_de_tu_red";
const char MQTT_HOST[] = "192.168.1.100"; // reemplazar por la IP LAN de tu computadora
```

La ESP32 clásica usa Wi-Fi de **2.4 GHz**. La computadora y la ESP32 deben poder comunicarse en la misma red local; una red de invitados o con aislamiento de clientes puede impedirlo.
En el Mac podés consultar la IP Wi-Fi desde **Configuración del Sistema → Wi-Fi → Detalles → TCP/IP**. También podés ejecutar `ipconfig getifaddr en0` si el Wi-Fi usa esa interfaz.
En Linux usá `hostname -I`; en Windows, `ipconfig` y buscá la dirección IPv4 del adaptador conectado.

**Son dos direcciones diferentes:**

- En el firmware, `MQTT_HOST` es la **IP LAN de la computadora**. `localhost` apuntaría a la propia ESP32.
- En `.env`, `MQTT_HOST=localhost` es correcto si FastAPI y Mosquitto se ejecutan en la misma computadora.

`config.h` está excluido de Git para no subir la contraseña. Los cambios de red o broker requieren recompilar y cargar de nuevo el firmware.
El panel de configuración web puede generar otras cabeceras y emitir comandos MQTT, pero este firmware mínimo **no los consume**: sus parámetros se definen en `config.h`.

### C. Cargar el programa (una vez, o después de modificarlo)

1. Conectá la ESP32 por USB y abrí `firmware/pir_mqtt/pir_mqtt.ino` en Arduino IDE.
2. Seleccioná **ESP32 Dev Module** para la placa ESP32-WROOM-32 clásica.
3. Seleccioná el puerto USB de la placa, por ejemplo `/dev/cu.usbserial-...` en macOS. Puede cambiar al reconectar.
4. En **Tools → Upload Speed**, elegí **115200**.
5. Cerrá la conexión USB de la página si estaba abierta y pulsá **Subir →**, no Debug.
6. Esperá la verificación de escritura y el reinicio final. Después la placa ejecuta el programa sin Arduino IDE abierto.

### D. Iniciar el sistema y ver datos reales

Si el sistema ya está iniciado, usá esa instancia. Para iniciarlo desde la raíz:

```bash
./start.sh
```

La consola del backend debe indicar conexión y suscripción al broker. Si el firewall del sistema pregunta por Mosquitto, permití las conexiones entrantes desde la red local.
Abrí **http://localhost:5173/case/pir**. Esta es la vista de telemetría MQTT; **no hace falta pulsar Conectar ESP32**.
Los Casos 2 y 3 quedarán sin muestras hasta que publiques sus datos. El firmware lee cada 200 ms cuando la conexión está disponible y reintenta Wi-Fi/MQTT si se pierde la conexión. No acumula ni reenvía muestras tomadas sin conexión.

Para diagnosticar, podés abrir temporalmente el monitor serial de Arduino a **115200 baud**:

```text
Prueba PIR MQTT iniciada. Esperando Wi-Fi...
MQTT: conectando a 192.168.1.100:1883...
MQTT conectado. IP ESP32: ...
SIN MOVIMIENTO
MOVIMIENTO
```

Los mensajes de movimiento pueden aparecer aunque no haya conexión MQTT. **Ver `MOVIMIENTO` por Serial no demuestra que llegó al broker.** Comprobalo así en otra terminal:

```bash
mosquitto_sub -h localhost -p 1883 -t presence/pir/telemetry -v
```

Debe llegar JSON como:

```json
{"case_id":"pir","source":"pir-94e68605a918","presence":true,"raw_value":1}
```

El identificador `source` es único por placa. El firmware no envía una hora sin sincronizar ni inventa ground truth o latencia: el backend asigna su hora de recepción; `latency_ms=0` significa que no se midió la latencia física.
Verificá además **http://localhost:8000/api/v1/telemetry/status**: `pir.total_samples` debe aumentar, y el gráfico de `/case/pir` debe alternar cuando OUT cambie entre 0 y 1.

### E. Comprobar el sensor y guardar resultados

Después de alimentar el PIR, dejalo estabilizarse. Para el ensayo, apoyalo quieto, apuntá la cúpula blanca hacia una pared y mantené a las personas fuera de su campo de visión. Luego cruzá frente al sensor y volvé a alejarte.
El tiempo que permanece en alto depende de los ajustes del módulo. `SIN MOVIMIENTO` es salida baja, no una prueba de que no haya personas quietas.

En modo MQTT, FastAPI guarda automáticamente las muestras en SQLite por lotes, aproximadamente cada dos segundos. No se usa el botón de guardado de la página USB.
Consultá **http://localhost:8000/api/v1/telemetry/pir/history?limit=50**.
Las lecturas quedan en `backend/presence-hardware.db` y se conservan al detener o reiniciar el servidor.
Para comprobarlas, consultá el historial REST; podés inspeccionar el mismo archivo con una herramienta SQLite.
Conservá la base para analizar los datos adquiridos después.

Las métricas usan únicamente los ensayos que registres en **Sistema & Hardware** con ground truth independiente,
la detección observada y la latencia medida. No se insertan ensayos al iniciar ni se completan valores con resultados de ejemplo.
Guardar telemetría no genera por sí solo ensayos ni permite conocer la precisión del sensor.

## 5. Caso 2: CSI con router comercial

**Pendiente: el repositorio todavía no incluye firmware de captura CSI para este caso.**
El firmware PIR no obtiene CSI. Antes de realizar el ensayo hay que implementar y cargar el programa del receptor.
El contrato del mensaje está en [docs/mqtt-topics.md](docs/mqtt-topics.md); la captura puede basarse en [ESP-CSI de Espressif](https://github.com/espressif/esp-csi).

Cuando ese firmware esté disponible:

1. Programá el ESP32 receptor para conectarse al router comercial, capturar CSI de paquetes Wi-Fi y publicar amplitudes reales en `presence/csi/router/raw`, con `case_id: "csi_router"`.
2. Configurá la IP LAN del broker y verificá que el router permita comunicar el receptor con el servidor.
3. Iniciá `./start.sh` y observá los mensajes físicos con `mosquitto_sub -h localhost -t presence/csi/router/raw -v`.
4. Abrí **http://localhost:5173/case/csi_router**. Comprobá señal cruda, filtrada, descriptores y aumento de muestras.
5. Verificá registros en **http://localhost:8000/api/v1/telemetry/csi_router/history?limit=50**.
6. Registrá posición del router/receptor, canal, tráfico, distancia y personas presentes; conservá esos datos para evaluar la detección.

Encender el router por sí solo no envía muestras a la página. Sin el receptor programado, la vista espera datos.

## 6. Caso 3: CSI en red dedicada ESP32–ESP32

**Pendiente: todavía faltan los firmware del emisor AP y del receptor Station.**

Cuando esos firmware estén disponibles:

1. Programá el emisor ESP32 para generar tráfico controlado y el receptor para capturar CSI del enlace.
2. Configurá ambos nodos en el mismo canal. El receptor debe tener una ruta de red hacia Mosquitto; no asumas que la red dedicada está conectada a la LAN del servidor.
3. Publicá las amplitudes capturadas en `presence/csi/dedicated/raw`, con `case_id: "csi_dedicated"` y la IP LAN del broker.
4. Con `./start.sh` iniciado, comprobá la recepción con `mosquitto_sub -h localhost -t presence/csi/dedicated/raw -v`.
5. Abrí **http://localhost:5173/case/csi_dedicated** y verificá señal, procesamiento y aumento de muestras.
6. Consultá **http://localhost:8000/api/v1/telemetry/csi_dedicated/history?limit=50**.
7. Documentá ubicación, canal, potencia, tasa de paquetes y condiciones del ensayo para comparar luego con los otros métodos.

## 7. Diagnóstico USB que ya usamos

La ruta **http://localhost:5173/test/pir-usb** lee el Serial de la placa desde Chrome/Edge y tiene un guardado manual independiente.
Podés usarla con el firmware MQTT, que conserva `MOVIMIENTO` / `SIN MOVIMIENTO`; sus otros mensajes de diagnóstico se ignoran.

1. Iniciá el sistema con `./start.sh`.
2. Cerrá el monitor serial de Arduino para liberar el puerto.
3. Entrá a **Prueba PIR — USB → Conectar ESP32** y seleccioná el puerto.
4. Para guardar, pulsá **Guardar ... lecturas en la base** antes de salir o reconectar.

Esta prueba no comprueba MQTT ni alimenta las vistas generales del PIR. Conserva hasta 50 mensajes locales y guarda en `pir_usb_readings`, separada de la telemetría MQTT. Al usar el firmware MQTT, este puede publicar además por Wi-Fi si tiene broker disponible.

## 8. Ejecución manual y Docker

### Manual (tres terminales, sin start.sh)

Terminal 1, broker local:

```bash
mosquitto -c infrastructure/mosquitto/mosquitto.local.conf -v
```

Terminal 2, backend:

```bash
cd backend
source .venv/bin/activate
DATA_SOURCE=mqtt uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Terminal 3, frontend:

```bash
cd frontend
npm run dev -- --port 5173 --strictPort
```

En Windows, activá `backend/.venv/Scripts/Activate.ps1` en PowerShell y usá `$env:DATA_SOURCE="mqtt"` antes de ejecutar Uvicorn. Mosquitto y Node deben estar disponibles en PATH.

### Docker (alternativa; no ejecutar junto con start.sh)

Con Docker instalado y activo:

```bash
# El broker se expone por el puerto 1883 de la computadora
docker compose up --build
```

Abrí igualmente **http://localhost:5173**. Dentro de Docker el backend usa `MQTT_HOST=mosquitto`; la ESP32 sigue usando la IP LAN de la computadora.
La base del contenedor es `/data/presence-hardware.db` en el volumen `backend_data`; los archivos anteriores del volumen se conservan.
Para detener: **Ctrl+C** y `docker compose down`. Los datos quedan en volúmenes; no uses `down -v` si querés conservarlos.
La configuración Docker es `infrastructure/mosquitto/mosquitto.conf`. El listener 9001 es opcional para otras herramientas; nuestra web usa el WebSocket de FastAPI, no ese listener.

## 9. Si algo no funciona

| Síntoma | Qué revisar |
| --- | --- |
| `bad CPU type in executable` al compilar en Mac Apple Silicon | Si falla una herramienta Intel como `ctags`, instalar [Rosetta de Apple](https://support.apple.com/en-us/102527): `softwareupdate --install-rosetta`. |
| No aparece puerto USB | Reconectar la placa, usar cable de datos y volver a seleccionar el puerto en Arduino. |
| Puerto ocupado | Cerrar Serial Monitor y desconectar la prueba USB de la web antes de subir firmware. |
| Carga falla a 921600 | Seleccionar Upload Speed 115200; probar otro cable o puerto USB. |
| Símbolos ilegibles por Serial | Monitor a 115200 baud; es un ajuste distinto de Upload Speed. |
| `config.h: No such file` / `PubSubClient.h: No such file` | Copiar `config.example.h` a `config.h` / instalar PubSubClient. |
| No llega a `MQTT conectado` | Revisar Wi-Fi 2.4 GHz, clave, IP LAN, broker iniciado, firewall y aislamiento de clientes. |
| Serial muestra movimiento pero web no cambia | Verificar primero `mosquitto_sub`, luego `mqtt_connected`, `total_samples` y conexión WebSocket. |
| Configuración rechazada al iniciar | Usar `DATA_SOURCE=mqtt` en los archivos `.env`; revisar dirección y puerto del broker. |
| Puertos 8000 o 5173 ocupados | Detener la ejecución anterior. El script no mata procesos ajenos ni cambia de puerto silenciosamente. |
| Siempre muestra movimiento | Revisar VCC/GND/OUT, D27, estabilización, ajustes TIME/sensibilidad y campo de visión. No invertir la lógica del código para ocultarlo. |
| CSI no recibe puntos | Confirmar que el nodo físico captura y publica CSI para ese caso. El firmware CSI físico todavía no está incluido. |
| LIVE pero un caso desconectado | LIVE es el WebSocket del navegador. Un caso se considera conectado si recibió una muestra en los últimos 10 segundos. |

Cuando **Ctrl+C** detiene `start.sh`, se cierran solo el backend, Vite y broker que ese script inició. Un broker previamente activo permanece abierto. Arduino y la placa no se detienen con ese comando.

## 10. Registro y análisis posterior

Para cada prueba física anotá método, fecha, ubicación y orientación de los dispositivos, personas presentes,
movimiento realizado, duración y ajustes utilizados. Repetí condiciones comparables entre métodos.

Durante la adquisición comprobá que los tópicos reciban datos, los contadores aumenten y el historial SQLite tenga registros.
Después revisá esos datos y contrastá las detecciones con la observación independiente de presencia.
En **Sistema & Hardware** podés registrar los ensayos observados; **Comparación** calcula los indicadores a partir de ellos.
El PIR mide cambios asociados al movimiento: una salida baja no confirma por sí sola que el ambiente esté vacío.

## 11. Estructura y documentación

- `firmware/pir_mqtt/`: programa físico PIR por MQTT y ejemplo de configuración.
- `backend/app/data_sources/`: recepción de telemetría física MQTT y validación.
- `backend/app/signal_processing/`: filtros y descriptores CSI.
- `frontend/src/`: páginas, servicios, hooks y componentes del dashboard.
- `infrastructure/mosquitto/`: configuraciones para ejecución nativa y Docker.
- `tests/`: pruebas automatizadas.
- [BITACORA.md](BITACORA.md): actividades y dificultades documentadas.
- [docs/architecture.md](docs/architecture.md): arquitectura por capas.
- [docs/mqtt-topics.md](docs/mqtt-topics.md): tópicos y formatos JSON.
- [docs/signal-processing.md](docs/signal-processing.md): pipeline CSI.
- [docs/data-model.md](docs/data-model.md): datos experimentales.

Stack: ESP32/Arduino, MQTT/Mosquitto, Python 3.12+ con FastAPI/Pydantic/Uvicorn, SQLite, React/TypeScript/Vite/React Router y Apache ECharts.
