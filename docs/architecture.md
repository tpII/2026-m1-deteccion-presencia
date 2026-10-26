# Arquitectura del Sistema — Detección de Presencia PIR y CSI Wi-Fi

## 1. Visión General y Flujo de Datos

El sistema implementa una arquitectura desacoplada orientada a eventos para procesar y comparar tres tecnologías de detección en interiores:
1. Sensor PIR (Infrarrojo Pasivo).
2. CSI con Router Wi-Fi existente.
3. CSI en Red Dedicada (enlace ESP32 AP - ESP32 STA).

```
[ ESP32 Hardware ]
        │
        ▼ (MQTT / WiFi)
[ Broker Mosquitto:1883 ]
        │
        ▼ (paho-mqtt)
[ Backend FastAPI ] ◄────── [ MockDataSource ] (si DATA_SOURCE=mock)
   ├── Ingesta & Validación (Pydantic)
   ├── Detector CSI (indicadores de movimiento y forma + calibración)
   ├── Persistencia Asíncrona (SQLite / aiosqlite)
   └── Repositorio en Memoria (Buffer Circular de 500 puntos)
        │
        ├────────────────────────┬───────────────────────┐
        ▼ (WebSockets /ws)        ▼ (REST API /api/v1)    ▼ (Swagger Docs)
[ WebSocketManager ]      [ Endpoints HTTP ]      [ /docs ]
        │                        │
        └───────────┬────────────┘
                    ▼
          [ Frontend React + Vite ]
             ├── Hooks & Servicios
             ├── Apache ECharts (Canvas)
             └── UI Liquid Glass (Apple Aesthetic)
```

## 2. Responsabilidades por Capa

### A. Capa de Telemetría e Ingesta (`data_sources/`)
- **Abstracción `DataSource`**: Define la interfaz `start()`, `stop()`, `set_sample_handler()`.
- **`MockDataSource`**: Produce flujos sintéticos de alta fidelidad con ruido de radiofrecuencia, perturbaciones Doppler por presencia y outliers esporádicos para validar filtros.
- **`MQTTDataSource`**: Se conecta al broker Mosquitto, se suscribe a los tópicos definidos y reinyecta datos al mismo pipeline sin alterar el backend ni el frontend.

### B. Capa de Procesamiento de Señal (`signal_processing/`)
- **`CsiPresenceDetector`**: Calcula, en ventanas de 4 s, un indicador de movimiento (fluctuación del canal) y uno de forma (cambio respecto del canal vacío). Los umbrales se calibran en el lugar con la habitación vacía. Detalle en `docs/signal-processing.md`.

### C. Capa de Persistencia y Buffers (`repositories/`)
- **`InMemoryTelemetryRepository`**: Colección `deque(maxlen=500)` para proveer consultas en tiempo $O(1)$ y alimentar los gráficos en tiempo real sin saturar la base de datos con escrituras por milisegundo.
- **`MetricsRepository`**: Acceso asíncrono a SQLite para almacenar sesiones de prueba, registrar evaluaciones contra Ground Truth y calcular matrices de confusión (TP, TN, FP, FN, Tasa de Detección, Latencia).

### D. Capa de Transporte y API (`api/`)
- **FastAPI**: Rutas REST tipadas para métricas históricas y metadatos de configuración.
- **WebSockets Throttled**: Despacho de lotes a ~8 Hz hacia los clientes conectados para una experiencia visual ultrasuave con bajo consumo de CPU.

### E. Capa de Presentación (`frontend/`)
- **Flujo Unidireccional**: Componentes visuales desacoplados de llamadas de red. El hook `useTelemetry` provee el estado sincronizado en tiempo real.
- **Diseño Liquid Glass**: Paleta neutral de laboratorio, transparencias calibradas, desenfoque de fondo y triple codificación accesible (color + icono + texto).
