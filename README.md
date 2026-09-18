# Detección de Presencia mediante PIR y CSI Wi-Fi

Proyecto Universitario de Ingeniería — Taller de Proyecto II 2026 (Grupo M1)

Plataforma full-stack de adquisición, procesamiento de señal y visualización en tiempo real para la evaluación y comparación experimental de tres metodologías de detección de presencia humana en interiores:
1. **Caso 1 — Sensor PIR**: Detección térmica piroeléctrica por infrarrojo pasivo.
2. **Caso 2 — CSI con Router Wi-Fi**: Extracción de Channel State Information de subportadoras OFDM sobre red comercial existente.
3. **Caso 3 — CSI en Red Dedicada**: Enlace directo cerrado y controlado entre dos nodos ESP32 (Access Point y Station).

---

## 1. Arquitectura General

```
ESP32 (Hardware / ESP-IDF)
  │
  ▼ MQTT (1883)
Mosquitto Broker
  │
  ▼ paho-mqtt
FastAPI Backend ◄──────────── [ MockDataSource ] (si DATA_SOURCE=mock)
  │
  ├── Pipeline de Procesamiento de Señal (Hampel Filter + Moving Average + Varianza)
  ├── Persistencia Experimental (SQLite / aiosqlite)
  └── Buffer Circular en Memoria (500 muestras en tiempo real)
  │
  ├────────────────────────────┬────────────────────────────┐
  ▼ WebSocket (/ws/telemetry)   ▼ REST API (/api/v1)         ▼ Swagger (/docs)
WebSocket Manager              Endpoints HTTP               Documentación Interactiva
  │                            │
  └───────────────┬────────────┘
                  ▼
         React 18 + Vite Frontend
           ├── Dashboard Liquid Glass (Apple Lab Style)
           ├── Apache ECharts en Canvas
           └── Navegación Desacoplada (React Router)
```

---

## 2. Stack Tecnológico

### Frontend
- **Framework**: React 18 con TypeScript y Vite.
- **Rutas**: React Router DOM v6.
- **Motor de Gráficos**: Apache ECharts (renderizado Canvas de alta frecuencia y baja latencia).
- **Iconografía Técnica**: Lucide React.
- **Estilos**: Vanilla CSS con tokens de diseño y estética *Liquid Glass* (paneles translúcidos, desenfoque de fondo, bordes suaves y contraste de alta legibilidad).

### Backend
- **Framework**: Python 3.12+ (probado en 3.13) con FastAPI y Uvicorn.
- **Validación & Configuración**: Pydantic v2 y Pydantic-Settings.
- **Procesamiento de Señal & Científico**: NumPy y SciPy (Filtro Hampel por MAD, media móvil, varianza temporal).
- **Persistencia**: SQLite asíncrono con `aiosqlite`.
- **Telemetría**: WebSockets nativos de FastAPI y cliente MQTT `paho-mqtt`.

---

## 3. Estructura de Carpetas

```
tp2/
├── README.md               # Documentación principal del proyecto
├── .gitignore              # Exclusiones de Git
├── .env.example            # Plantilla de variables de entorno
├── docker-compose.yml      # Orquestación con Docker
│
├── frontend/               # Aplicación web React + TypeScript + ECharts
│   ├── src/
│   │   ├── components/     # Componentes Glass, gráficos, pipeline y tablas
│   │   ├── pages/          # Overview, PIR, CSI Router, CSI Dedicado, Comparación, Sistema
│   │   ├── services/       # Cliente HTTP y WebSocket con reconexión automática
│   │   ├── hooks/          # useTelemetry, useMetrics, useWebSocket
│   │   ├── styles/         # Tokens de diseño y utilidades Glass
│   │   └── types/          # Definiciones TypeScript de datos y señales
│   └── package.json
│
├── backend/                # Servicio FastAPI, procesamiento y WebSockets
│   ├── app/
│   │   ├── api/            # Rutas REST (/health, /telemetry, /metrics, /cases) y /ws
│   │   ├── core/           # Configuración (settings), constantes y logs
│   │   ├── data_sources/   # Abstracción DataSource (MockDataSource y MQTTDataSource)
│   │   ├── database/       # Conexión SQLite y esquema relacional
│   │   ├── repositories/   # Buffers circulares en memoria y persistencia
│   │   ├── schemas/        # Modelos de validación Pydantic
│   │   ├── services/       # Orquestadores de telemetría y métricas
│   │   └── signal_processing/ # Filtros (Hampel, MA, LowPass) y Pipeline modular
│   ├── requirements.txt
│   └── pyproject.toml
│
├── infrastructure/         # Configuración del broker Mosquitto (mosquitto.conf)
├── scripts/                # Simulador MQTT (ESP32 publisher), generador de datos y reset DB
├── tests/                  # Tests unitarios y de integración de backend y frontend
└── docs/                   # Documentación detallada (arquitectura, tópicos MQTT, modelos, señal)
```

---

## 4. Requisitos Previos

- **Node.js**: $\ge 20.0.0$ (recomendado 22 LTS o 24)
- **npm**: $\ge 10.0.0$
- **Python**: $\ge 3.12$ (recomendado 3.12 o 3.13)
- **Git**
- *(Opcional)* Docker y Docker Compose si se desea levantar en contenedores.

---

## 5. Instalación Paso a Paso

### 1. Clonar y configurar variables de entorno

Copiar el archivo de configuración base:

```bash
cp .env.example .env
```

### 2. Configurar e Instalar Backend

```bash
cd backend

# Crear entorno virtual de Python
python3 -m venv .venv

# Activar el entorno virtual:
# En macOS / Linux:
source .venv/bin/activate
# En Windows:
# .venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt
cd ..
```

### 3. Configurar e Instalar Frontend

```bash
cd frontend
npm install
cd ..
```

---

## 6. Ejecución en Modo MOCK (Simulación sin Hardware)

El sistema viene preconfigurado con `DATA_SOURCE=mock` para operar de forma 100% autónoma sin microcontroladores conectados.

### Terminal 1 — Backend:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

- API Swagger: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

### Terminal 2 — Frontend:

```bash
cd frontend
npm run dev
```

- Dashboard Web: [http://localhost:5173](http://localhost:5173)

Al abrir la aplicación se observará la señal en vivo transmitiéndose por WebSocket, los estados de presencia alternando y el pipeline de procesamiento CSI ejecutándose en tiempo real.

---

## 7. Ejecución en Modo Hardware con Broker MQTT

Cuando se conecten los nodos físicos ESP32:

1. **Iniciar el broker Mosquitto**:
   ```bash
   # Vía Mosquitto local:
   mosquitto -c infrastructure/mosquitto/mosquitto.conf -v
   
   # O vía Docker:
   docker run -d -p 1883:1883 -v $(pwd)/infrastructure/mosquitto/mosquitto.conf:/mosquitto/config/mosquitto.conf eclipse-mosquitto:2.0
   ```

2. **Cambiar la fuente de datos en `.env`**:
   ```ini
   DATA_SOURCE=mqtt
   MQTT_HOST=localhost
   MQTT_PORT=1883
   ```

3. **Iniciar el backend**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

4. **(Opcional) Probar con el simulador de ESP32**:
   Si los ESP32 reales aún no están flasheados pero se desea validar el enlace MQTT completo:
   ```bash
   python scripts/mqtt_test_publisher.py --host localhost --port 1883 --case all
   ```

---

## 8. Ejecución con Docker Compose

Para levantar Mosquitto, Backend y Frontend en un único comando:

```bash
docker compose up --build
```

---

## 9. Pruebas Automatizadas

### Backend:

```bash
cd backend
source .venv/bin/activate
pytest ../tests/backend -v
```

### Frontend:

```bash
cd frontend
npm run build
```

---

## 10. Resolución de Problemas Frecuentes (Troubleshooting)

- **Puerto 8000 o 5173 ocupado**:
  - Backend: `uvicorn app.main:app --reload --port 8001` y actualizar `VITE_API_URL` en `frontend/.env`.
  - Frontend: Vite asignará automáticamente el siguiente puerto libre (ej. `5174`).
- **WebSocket indica 'RECONNECTING' u 'OFFLINE'**:
  - Verificar que el backend esté corriendo en el puerto 8000 y responda en `http://localhost:8000/api/v1/health`.
- **CORS Error en consola del navegador**:
  - Asegurarse de que el origen del frontend esté en la variable `CORS_ORIGINS` del backend en `.env` (por defecto `http://localhost:5173`).
- **MQTT Broker Connection Refused**:
  - Si `DATA_SOURCE=mqtt`, verificar que Mosquitto esté corriendo en el puerto 1883 (`telnet localhost 1883`). Para desarrollo sin broker, cambiar a `DATA_SOURCE=mock`.
- **Restaurar base de datos a estado original**:
  - Ejecutar: `python scripts/reset_database.py`.
