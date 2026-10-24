# Arquitectura y recorrido del código

El recorrido normal es:

```text
ESP32 → Mosquitto → mqtt.py → telemetry.py
                               ├── signal_processing/ (CSI)
                               ├── telemetry_state.py → REST / WebSocket → React
                               └── repositories/ → SQLite → REST de historial / métricas → React

Captura actual del router: prueba_CSI/ → Serial / CSV (sin conexión a MQTT)
```

## Backend

Todo empieza en `backend/app/main.py`: crea FastAPI, registra las rutas, prepara las tablas y arranca MQTT. Al detenerse, cierra MQTT y guarda las muestras pendientes.

| Archivo o carpeta en `backend/app/` | Responsabilidad |
| --- | --- |
| `config.py` | Leer `.env` y variables de entorno. |
| `constants.py` | Identificadores de los tres métodos y tópicos MQTT. |
| `logging_config.py` | Configurar los mensajes de consola. |
| `mqtt.py` | Conectarse a Mosquitto, validar JSON y entregar muestras. |
| `telemetry.py` | Procesar muestras y coordinar MQTT, estado, persistencia y difusión. |
| `telemetry_state.py` | Conservar señales y estados en memoria y construir mensajes WebSocket. |
| `database.py` | Abrir SQLite y crear las tablas que se usan. |
| `websocket.py` | Mantener las conexiones de los navegadores. |
| `api/` | Rutas de salud, telemetría, métricas, USB y WebSocket. |
| `schemas/` | Modelos Pydantic de entrada y salida. |
| `repositories/` | Escrituras y consultas SQLite. La cola de telemetría conserva los lotes fallidos para reintentarlos. |
| `signal_processing/filters.py` | Hampel y media móvil. |
| `signal_processing/pipeline.py` | Aplicar filtros, calcular características y decidir presencia. |

La señal PIR ya es digital. CSI pasa por el pipeline; cada método CSI tiene su propio umbral.
La telemetría se escribe por lotes aproximadamente cada dos segundos. El navegador recibe actualizaciones aproximadamente ocho veces por segundo en `/ws/telemetry`. Las consultas históricas usan REST. Persistencia y difusión tienen tareas separadas. Al detenerse, MQTT termina de entregar las muestras pendientes y el backend espera las escrituras activas antes del último guardado.

Para agregar o modificar una ruta, entrar en `api/`. Para cambiar un cálculo CSI, entrar en `signal_processing/`. Para cambiar cómo se guarda un dato, entrar en `repositories/`.

## Frontend

`frontend/src/main.tsx` carga `App.tsx`, donde se definen las rutas. `pages/` contiene las pantallas y `components/` los elementos que comparten.

`context/TelemetryContext.tsx` mantiene una conexión WebSocket y una suscripción compartida para todas las pantallas. Al caer la conexión, los sensores dejan de mostrarse conectados.

`hooks/useApiQuery.ts` maneja carga, errores, actualización y cancelación de consultas REST. `hooks/useCaseMetrics.ts` reúne métricas y ensayos de un caso. `services/api.ts` consulta REST, `services/websocket.ts` recibe telemetría en vivo y `services/pirSerial.ts` lee el puerto USB. La conexión MQTT pertenece al backend.

Las dos páginas CSI se resuelven con `pages/CsiCasePage.tsx` y las descripciones de `config/cases.ts`. Los componentes están agrupados por responsabilidad. `components/charts/Chart.tsx` administra creación, tamaño y cierre de ECharts; los otros gráficos definen sus opciones. `components/system/TrialForm.tsx` administra el registro manual de ensayos.

El tema claro/oscuro vive en `context/ThemeContext.tsx`. Los estilos están en `styles/` y las direcciones del backend en `config/env.ts`.

## Configuración física

El firmware incluido se configura en `firmware/pir/include/config.h`. El proyecto PlatformIO vive en `firmware/pir/`, basado en `PRUEBA_PIR` de la rama `bernardo`. `src/main.cpp` lee el sensor y escribe por Serial; `src/network.cpp` mantiene Wi-Fi/MQTT y publica el mismo estado. Cambiar la configuración requiere recompilar y cargar la ESP32 con PlatformIO. No hay un panel web de calibración remota: el firmware actual no recibe esos comandos.

## Estado de integración CSI

`prueba_CSI/` incluye un proyecto PlatformIO que captura CSI del router y escribe CSV por Serial. No publica MQTT ni alimenta el dashboard. Falta convertir la captura en amplitudes y publicarlas con el contrato de [mqtt-topics.md](mqtt-topics.md). El backend procesa sólo la primera amplitud de cada mensaje, no el vector completo ni los bytes CSI originales.

El caso dedicado todavía no tiene firmware del emisor AP ni del receptor Station. La [guía de pruebas](pruebas.md) distingue la captura existente, la integración pendiente y la validación física. Las pruebas automáticas usan publicadores controlados, no los ESP32.

## Validación de la API

Los identificadores de método se validan con `CaseId`: un valor inválido responde HTTP 422. Los historiales REST aceptan entre 1 y 500 registros. Las amplitudes CSI deben formar una lista no vacía de números finitos. Las latencias de entrada deben ser finitas y no negativas, y los scores de ensayos deben estar entre 0 y 1.
