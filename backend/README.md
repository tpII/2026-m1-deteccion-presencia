# Backend — Detección de Presencia mediante PIR y CSI Wi-Fi

Servicio backend de alto rendimiento desarrollado con **FastAPI**, **Pydantic v2**, **WebSockets**, **NumPy/SciPy** y **aiosqlite**.

## Características

- **Arquitectura desacoplada**: Capa de ingesta de hardware (`MQTTDataSource`) separada del procesamiento y la API.
- **Pipeline de Procesamiento de Señal**: Filtro de Hampel para eliminación de valores atípicos (*outliers*) basado en Desviación Absoluta de la Mediana (MAD), filtro de Media Móvil y extracción de varianza/energía temporal.
- **Transmisión en Tiempo Real**: WebSocket `/ws/telemetry` con control de tasa de refresco (~8 Hz) y buffer circular en memoria para evitar latencia de base de datos.
- **Persistencia Experimental**: Almacenamiento en SQLite para registro de ensayos con Ground Truth y cálculo de matrices de confusión (TP, TN, FP, FN, Tasa de detección, Latencia media).

## Estructura del Código

```
backend/
├── app/
│   ├── api/                # Endpoints REST y WebSocket
│   │   ├── routes/         # health, telemetry, metrics, cases, websocket
│   │   └── dependencies.py # Inyección de dependencias
│   ├── core/               # Configuración (Pydantic Settings), constantes, logs
│   ├── database/           # Conexión asíncrona SQLite y esquema
│   ├── data_sources/       # Recepción de telemetría física MQTT
│   ├── models/             # Modelos de dominio
│   ├── repositories/       # Buffers circulares en memoria y consultas SQLite
│   ├── schemas/            # Esquemas de validación Pydantic
│   ├── services/           # Lógica de orquestación, telemetría y métricas
│   ├── signal_processing/  # Filtros (Hampel, MA, LowPass) y Pipeline modular
│   └── main.py             # Instancia FastAPI y ciclo de vida (lifespan)
├── Dockerfile
├── pyproject.toml
└── requirements.txt
```

## Instalación y Ejecución Local

### 1. Crear entorno virtual

```bash
cd backend
python3 -m venv .venv

# Activar en macOS / Linux:
source .venv/bin/activate

# Activar en Windows:
# .venv\Scripts\activate
```

### 2. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 3. Iniciar el servidor

```bash
uvicorn app.main:app --reload --port 8000
```

- Documentación interactiva Swagger: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health check: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)
- WebSocket endpoint: `ws://localhost:8000/ws/telemetry`

## Conexión al hardware mediante MQTT

Modificar en el archivo `.env`:

```ini
DATA_SOURCE=mqtt
MQTT_HOST=localhost
MQTT_PORT=1883
```

Iniciá primero Mosquitto. El backend procesa los tópicos PIR y CSI especificados en [docs/mqtt-topics.md](../docs/mqtt-topics.md).
La guía de carga del firmware y pruebas físicas está en el [README principal](../README.md).
La base por defecto es `presence-hardware.db` al ejecutar desde `backend/`. Se inicializa vacía y conserva las muestras recibidas y los ensayos registrados; no precarga resultados.
