# Detección de presencia: PIR y Wi-Fi CSI

Proyecto de Taller de Proyecto II para comparar tres métodos: sensor PIR, CSI con router y CSI entre dos ESP32.

```text
ESP32 → MQTT / Mosquitto → FastAPI
                            ├── Estado en memoria → WebSocket / REST → React
                            └── SQLite → REST de historial y métricas → React
```

El firmware PIR de `firmware/pir/` publica por MQTT. `prueba_CSI/` ya captura CSI del router y lo imprime por Serial, pero todavía no convierte ni publica esas capturas en MQTT. El caso CSI dedicado no tiene firmware. Ambos casos CSI tienen recepción de amplitudes, procesamiento y pantallas preparados en el backend; sin mensajes MQTT, esas pantallas esperan muestras.

## Instalar y ejecutar

Requisitos: Python 3.12+, Node.js 20+ y Mosquitto. Ejecutar desde la raíz:

```bash
cp -n .env.example .env
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
npm --prefix frontend ci
./start.sh
```

Para instalar Mosquitto: `brew install mosquitto` en macOS o `sudo apt install mosquitto mosquitto-clients` en Ubuntu/Debian.

- Dashboard: http://localhost:5173
- API y sus endpoints: http://localhost:8000/docs
- Detener: `Ctrl+C`.

`start.sh` inicia Mosquitto si el broker configurado es `localhost` o `127.0.0.1` en el puerto `1883` y no responde; después inicia backend y frontend. Reutiliza el broker si ya responde. Para otro host o puerto, el broker debe iniciarse por separado. Funciona en macOS/Linux; en Windows se puede usar WSL o la [ejecución manual](docs/pruebas.md#8-ejecución-manual).

## Dónde está cada cosa

| Carpeta | Para qué sirve |
| --- | --- |
| `backend/app/` | Recibir mensajes MQTT, procesarlos y servir la API. |
| `backend/app/api/` | Direcciones HTTP y WebSocket que consulta la web. |
| `backend/app/telemetry_state.py` | Estado en vivo y buffers de las señales. |
| `backend/app/repositories/` | Guardar y consultar muestras y ensayos en SQLite. |
| `backend/app/schemas/` | Validar la forma de los datos con Pydantic. |
| `backend/app/signal_processing/` | Filtros y detección CSI. |
| `frontend/src/pages/` | Una pantalla por archivo. |
| `frontend/src/components/` | Componentes agrupados en `charts/`, `layout/`, `metrics/`, `signal/`, `system/` y `ui/`. |
| `frontend/src/hooks/` | Conectar los datos con las pantallas de React. |
| `frontend/src/services/` | Comunicación HTTP, WebSocket y USB. |
| `frontend/src/types/` | Tipos TypeScript de los datos. |
| `frontend/src/context/`, `config/`, `styles/` | Telemetría compartida, tema claro/oscuro, configuración y estilos. |
| `firmware/pir/` | Proyecto PlatformIO del PIR, basado en la rama `bernardo`, con salida USB y publicación MQTT. |
| `prueba_CSI/` | Captura CSI del router por Serial, separada de la ingesta MQTT. |
| `mosquitto/` | Configuración del broker MQTT. |
| `tests/` | Pruebas automáticas del backend, USB y arranque. |
| `docs/` | Guías técnicas e informes del trabajo en `informes/`. |

`backend/.venv/` y `frontend/node_modules/` son dependencias instaladas automáticamente. No se editan ni se suben a Git. `frontend/dist/` se genera con `npm run build`.

## Configuración y datos

- **Backend:** `.env` en la raíz. Si existe `backend/.env`, tiene prioridad; las variables de la terminal tienen prioridad sobre ambos archivos.
- **Depuración:** `APP_DEBUG=true` habilita los registros de acceso. La variable genérica `DEBUG` no configura este backend.
- **ESP32 PIR:** copiar `firmware/pir/include/config.example.h` como `firmware/pir/include/config.h`, completar Wi-Fi e IP LAN del broker y compilar/cargar con PlatformIO. Ese archivo no se sube a Git.
- **Frontend:** usa `localhost:8000`; se puede cambiar con `VITE_API_URL` y `VITE_WS_URL` en `frontend/.env.local`.
- **Mediciones:** SQLite, normalmente `backend/presence-hardware.db` al iniciar con `start.sh`. Una ruta relativa en `DATABASE_URL` se resuelve desde la carpeta en que se ejecuta el backend.

La telemetría MQTT se guarda automáticamente. Los ensayos con presencia observada se registran en **Sistema & Hardware** y alimentan **Comparación**. La prueba USB es un diagnóstico separado con guardado manual.

## Compilar y cargar el PIR

Instalá PlatformIO IDE en VS Code y abrí `firmware/pir/` como proyecto. Con PlatformIO Core también podés ejecutar desde la raíz:

```bash
cp -n firmware/pir/include/config.example.h firmware/pir/include/config.h
pio run --project-dir firmware/pir
pio run --project-dir firmware/pir --target upload
```

La placa configurada es `upesy_wroom`, como en el proyecto de Bernardo. El puerto USB se detecta automáticamente; no se fija `COM9`. El firmware mantiene GPIO27 con `INPUT_PULLDOWN`, mensajes Serial a 115200 baud y muestreo nominal cada 500 ms. MQTT y Serial funcionan desde el mismo programa. Más detalles en [firmware/pir/README.md](firmware/pir/README.md).

## Comprobar el proyecto

```bash
backend/.venv/bin/python -m pytest
npm --prefix frontend test
npm --prefix frontend run build
```

Pruebas opcionales con procesos reales, con los puertos 1883, 8000 y 5173 libres. Los mensajes los publican los tests; no requieren ESP32 ni validan la detección física:

```bash
RUN_MQTT_INTEGRATION=1 backend/.venv/bin/python -m pytest tests/integration
```

Los tests usan bases temporales. La prueba física requiere conectar y programar las placas.

## Documentación

- [Pruebas con hardware, cableado, PlatformIO y solución de problemas](docs/pruebas.md).
- [Arquitectura y recorrido del código](docs/architecture.md).
- [Cómo leer y modificar el código, paso a paso](docs/recorrido-codigo.md).
- [Qué comprueban las pruebas automáticas](docs/pruebas-automaticas.md).
- [Tópicos y mensajes MQTT](docs/mqtt-topics.md).
- [Filtros y detección CSI](docs/signal-processing.md).
- [Datos y métricas](docs/data-model.md).
- [Auditoría y limpieza del repositorio](docs/auditoria.md).
- [Auditoría final y comprobaciones realizadas](docs/auditoria-final.md).
- [Bitácora del trabajo](BITACORA.md).
