# Guía de pruebas con hardware

Los comandos se ejecutan desde la raíz del repositorio, salvo que se indique otra carpeta.

## 1. Pruebas con hardware

Las pruebas experimentales requieren dispositivos físicos. La web espera mensajes MQTT; no genera señales ni precarga resultados. Las pruebas automáticas de integración publican mensajes controlados y no comprueban hardware ni exactitud física.

| Caso | Hardware | Estado y vista |
| --- | --- | --- |
| 1 — PIR por MQTT | ESP32, PIR HW-416-B y Wi-Fi de 2.4 GHz | Firmware incluido. Vista `/case/pir`; guía en sección 4 |
| 2 — CSI con router | ESP32 receptor y router comercial | `prueba_CSI/` captura por Serial; falta integrar amplitudes por MQTT con `/case/csi_router` |
| 3 — CSI dedicado | Dos ESP32, emisor AP y receptor Station | Backend y vista `/case/csi_dedicated` disponibles; faltan firmware de ambos nodos |
| Diagnóstico PIR por USB | ESP32 y PIR con firmware que emite mensajes Serial | Vista `/test/pir-usb`; guía en sección 7 |

El comando común es **`./start.sh`**. Los tres casos pueden adquirir datos simultáneamente cuando sus nodos estén programados y conectados.

**Para cumplir la arquitectura del informe, la prueba física del Caso 1 debe usar MQTT.** USB sirve para programar y alimentar la placa, y opcionalmente para diagnosticarla. PlatformIO puede cerrarse después de cargar el firmware.

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

Requisitos: Python 3.12+, Node.js 20+, npm y Git. Para MQTT necesitás Mosquitto. Para programar la ESP32 necesitás PlatformIO IDE en VS Code o PlatformIO Core.
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
`start.sh` utiliza MQTT y también acepta `./start.sh mqtt`. Para el inicio manual,
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

No hace falta iniciar un servicio permanente: `start.sh` levanta el broker si está configurado en `localhost` o `127.0.0.1`, puerto 1883, y no responde. Si el broker configurado ya responde, lo reutiliza. Para otro host o puerto hay que iniciar el broker por separado; `.env` configura al cliente del backend, no modifica `mosquitto.conf`.
La configuración es `mosquitto/mosquitto.conf`; permite conexiones de la ESP32 desde la red local.
El broker de laboratorio permite conexiones sin contraseña. Usalo en una red de laboratorio; no publiques el puerto 1883 en Internet.

### PlatformIO para el Caso 1

Instalá [PlatformIO IDE para VS Code](https://platformio.org/install/ide?install=vscode) y abrí `firmware/pir/` como proyecto. La extensión incluye PlatformIO Core y su terminal. También se puede instalar [PlatformIO Core](https://docs.platformio.org/en/latest/core/installation/index.html) por separado para usar los comandos `pio`.

`platformio.ini` declara la placa `upesy_wroom`, el framework Arduino y PubSubClient 2.8. PlatformIO instala las dependencias al compilar; no se usa Arduino IDE ni su gestor de bibliotecas.

El proyecto proviene de `PRUEBA_PIR` en la rama `bernardo`. Conserva GPIO27 con `INPUT_PULLDOWN`, Serial a 115200 baud y lectura cada 500 ms; se agregó Wi-Fi/MQTT en un módulo separado. PlatformIO utiliza el framework Arduino para ESP32, aunque el proyecto ya no contiene un sketch `.ino`.

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
La ESP32 conserva su firmware y sigue ejecutándolo mientras esté alimentada. PlatformIO se usa para compilar y cargar los cambios del programa.

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

El proyecto está en **`firmware/pir/`**. `src/main.cpp` lee el PIR y `src/network.cpp` administra Wi-Fi/MQTT.

Copiá `include/config.example.h` como `include/config.h`. Desde la raíz, en macOS/Linux:

```bash
cp -n firmware/pir/include/config.example.h firmware/pir/include/config.h
```

En Windows se puede copiar y renombrar el archivo desde VS Code. Completá `WIFI_SSID`, `WIFI_PASSWORD` y `MQTT_HOST` dentro de `config.h`. El archivo está excluido de Git. La frecuencia nominal queda definida por `SAMPLE_INTERVAL_MS=500`; el pin es GPIO27, configurado como `INPUT_PULLDOWN`.

La ESP32 clásica usa Wi-Fi de **2.4 GHz**. La computadora y la ESP32 deben poder comunicarse en la misma red local; una red de invitados o con aislamiento de clientes puede impedirlo.
En el Mac podés consultar la IP Wi-Fi desde **Configuración del Sistema → Wi-Fi → Detalles → TCP/IP**. También podés ejecutar `ipconfig getifaddr en0` si el Wi-Fi usa esa interfaz.
En Linux usá `hostname -I`; en Windows, `ipconfig` y buscá la dirección IPv4 del adaptador conectado.

- En el firmware, `MQTT_HOST` es la **IP LAN de la computadora**. `localhost` apuntaría a la propia ESP32.
- En `.env`, `MQTT_HOST=localhost` es correcto si FastAPI y Mosquitto se ejecutan en la misma computadora.

Los cambios de configuración requieren recompilar y cargar de nuevo el firmware.

### C. Compilar y cargar el programa

1. Conectá la ESP32 por USB y abrí `firmware/pir/` en PlatformIO IDE.
2. Cerrá cualquier monitor serial o conexión USB de la web que tenga abierto el puerto.
3. Usá **Build** y después **Upload** en PlatformIO. No se usa Debug para cargar el programa.
4. Esperá la confirmación de carga y el reinicio. La ESP32 sigue funcionando aunque cierres VS Code.

Con PlatformIO Core, desde la raíz:

```bash
pio run --project-dir firmware/pir
pio device list
pio run --project-dir firmware/pir --target upload
```

El entorno es `upesy_wroom`, conservado de Bernardo. Si la placa física es otra, configurá su identificador en `board` antes de cargar. No se fija un puerto en el proyecto: PlatformIO intenta detectarlo. Si hay varias placas conectadas, indicá el puerto con `--upload-port PUERTO` en el comando de carga. La velocidad de carga es 115200.

### D. Iniciar el sistema y ver datos reales

Si el sistema ya está iniciado, usá esa instancia. Para iniciarlo desde la raíz:

```bash
./start.sh
```

La consola del backend debe indicar conexión y suscripción al broker. Si el firewall del sistema pregunta por Mosquitto, permití las conexiones entrantes desde la red local.
Abrí **http://localhost:5173/case/pir**. Esta es la vista de telemetría MQTT; **no hace falta pulsar Conectar ESP32**.
Los Casos 2 y 3 quedarán sin muestras hasta que publiques sus datos. El firmware lee cada 500 ms nominales cuando la conexión está disponible y reintenta Wi-Fi/MQTT si se pierde la conexión. No acumula ni reenvía muestras tomadas sin conexión.

Para diagnosticar, abrí el monitor de PlatformIO a **115200 baud**:

```bash
pio device monitor --project-dir firmware/pir --baud 115200
```

Debe mostrar mensajes como:

```text
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
Verificá además **http://localhost:8000/api/v1/telemetry/status**: en la lista, el elemento con `case_id: "pir"` debe aumentar su `total_samples`, y el gráfico de `/case/pir` debe alternar cuando OUT cambie entre 0 y 1.

### E. Comprobar el sensor y guardar resultados

Después de alimentar el PIR, dejalo estabilizarse. Para el ensayo, apoyalo quieto, apuntá la cúpula blanca hacia una pared y mantené a las personas fuera de su campo de visión. Luego cruzá frente al sensor y volvé a alejarte.
El tiempo que permanece en alto depende de los ajustes del módulo. `SIN MOVIMIENTO` es salida baja, no una prueba de que no haya personas quietas.

En modo MQTT, FastAPI guarda automáticamente las muestras en SQLite por lotes, aproximadamente cada dos segundos. No se usa el botón de guardado de la página USB.
Consultá **http://localhost:8000/api/v1/telemetry/pir/history?limit=50**.
Con el `DATABASE_URL` predeterminado y `start.sh`, las lecturas quedan en `backend/presence-hardware.db` y se conservan al detener o reiniciar el servidor. Si cambiaste la configuración, consultá ese otro archivo.
Para comprobarlas, consultá el historial REST; podés inspeccionar el mismo archivo con una herramienta SQLite.
Conservá la base para analizar los datos adquiridos después.

Las métricas usan únicamente los ensayos que registres en **Sistema & Hardware** con ground truth independiente,
la detección observada y la latencia medida. No se insertan ensayos al iniciar ni se completan valores con resultados de ejemplo.
Guardar telemetría no genera por sí solo ensayos ni permite conocer la precisión del sensor.

## 5. Caso 2: CSI con router comercial

El proyecto [prueba_CSI/](../prueba_CSI/README.md) ya conecta un ESP32 al router, captura CSI y lo escribe por Serial. Se compila y carga por separado del firmware PIR. El monitor CSI funciona a **921600 baud**, no a los 115200 del PIR. Su salida CSV continua se activa con `c`.

**Pendiente: integrar esa captura con MQTT.** El backend no lee el puerto Serial CSI ni convierte su CSV. Hay que seleccionar los datos de la captura, convertirlos a amplitudes y publicarlos según [mqtt-topics.md](mqtt-topics.md). No hay un adaptador incluido.

Cuando esa integración esté implementada:

1. Programá el ESP32 receptor para conectarse al router comercial, capturar CSI de paquetes Wi-Fi y publicar amplitudes reales en `presence/csi/router/raw`, con `case_id: "csi_router"`.
2. Configurá la IP LAN del broker y verificá que el router permita comunicar el receptor con el servidor.
3. Iniciá `./start.sh` y observá los mensajes físicos con `mosquitto_sub -h localhost -t presence/csi/router/raw -v`.
4. Abrí **http://localhost:5173/case/csi_router**. Comprobá señal cruda, filtrada, descriptores y aumento de muestras.
5. Verificá registros en **http://localhost:8000/api/v1/telemetry/csi_router/history?limit=50**.
6. Registrá posición del router/receptor, canal, tráfico, distancia y personas presentes; conservá esos datos para evaluar la detección.

Encender el router o ejecutar la captura Serial por sí solos no envía muestras a la página. La vista espera mensajes MQTT con amplitudes; ver datos CSV en el monitor no demuestra recepción en el backend.

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
2. Cerrá el monitor serial de PlatformIO para liberar el puerto.
3. Entrá a **Prueba PIR — USB → Conectar ESP32** y seleccioná el puerto.
4. Para guardar, pulsá **Guardar ... lecturas en la base** antes de salir o reconectar.

Esta prueba no comprueba MQTT ni alimenta las vistas generales del PIR. Conserva hasta 50 mensajes locales y guarda en `pir_usb_readings`, separada de la telemetría MQTT. Al usar el firmware MQTT, este puede publicar además por Wi-Fi si tiene broker disponible.

## 8. Ejecución manual

### Manual (tres terminales, sin start.sh)

Terminal 1, broker local:

```bash
mosquitto -c mosquitto/mosquitto.conf -v
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

## 9. Si algo no funciona

| Síntoma | Qué revisar |
| --- | --- |
| `bad CPU type in executable` al compilar en Mac Apple Silicon | Si falla una herramienta Intel del compilador, instalar [Rosetta de Apple](https://support.apple.com/en-us/102527): `softwareupdate --install-rosetta`. |
| No aparece puerto USB | Reconectar la placa, usar cable de datos y usar `pio device list` e indicar el puerto a PlatformIO. |
| Puerto ocupado | Cerrar Serial Monitor y desconectar la prueba USB de la web antes de subir firmware. |
| Carga falla a 921600 | Configurar `upload_speed = 115200`; probar otro cable o puerto USB. |
| Símbolos ilegibles por Serial | Monitor PIR a 115200 baud; monitor de `prueba_CSI/` a 921600. Es un ajuste distinto de Upload Speed. |
| `config.h: No such file` / `PubSubClient.h: No such file` | Copiar `include/config.example.h` a `include/config.h`; compilar con PlatformIO para que instale `lib_deps`. |
| No llega a `MQTT conectado` | Revisar Wi-Fi 2.4 GHz, clave, IP LAN, broker iniciado, firewall y aislamiento de clientes. |
| Serial muestra movimiento pero web no cambia | Verificar primero `mosquitto_sub`, luego `mqtt_connected`, `total_samples` y conexión WebSocket. |
| Configuración rechazada al iniciar | Usar `DATA_SOURCE=mqtt` en los archivos `.env`; revisar dirección y puerto del broker. |
| Puertos 8000 o 5173 ocupados | Detener la ejecución anterior. El script no mata procesos ajenos ni cambia de puerto silenciosamente. |
| Siempre muestra movimiento | Revisar VCC/GND/OUT, D27, estabilización, ajustes TIME/sensibilidad y campo de visión. No invertir la lógica del código para ocultarlo. |
| CSI no recibe puntos | `prueba_CSI/` sólo imprime por Serial; falta su conversión y publicación MQTT. El caso dedicado no tiene firmware. Comprobar el tópico antes del dashboard. |
| LIVE pero un caso desconectado | LIVE es el WebSocket del navegador. Un caso se considera conectado si recibió una muestra en los últimos 10 segundos. |

Cuando **Ctrl+C** detiene `start.sh`, se cierran solo el backend, Vite y broker que ese script inició. Un broker previamente activo permanece abierto. El firmware de la placa no se detiene con ese comando.

## 10. Registro y análisis posterior

Para cada prueba física anotá método, fecha, ubicación y orientación de los dispositivos, personas presentes,
movimiento realizado, duración y ajustes utilizados. Repetí condiciones comparables entre métodos.

Durante la adquisición comprobá que los tópicos reciban datos, los contadores aumenten y el historial SQLite tenga registros.
Después revisá esos datos y contrastá las detecciones con la observación independiente de presencia.
En **Sistema & Hardware** podés registrar los ensayos observados; **Comparación** calcula los indicadores a partir de ellos.
El PIR mide cambios asociados al movimiento: una salida baja no confirma por sí sola que el ambiente esté vacío.

