# Modelo de Datos y Persistencia

## 1. Esquema Relacional SQLite (`presence.db`)

### Tabla: `trials`
Registra cada ensayo experimental individual evaluado contra Ground Truth.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | Identificador unívoco del ensayo |
| `case_id` | TEXT NOT NULL | Método evaluado: `'pir'`, `'csi_router'`, `'csi_dedicated'` |
| `timestamp` | TEXT NOT NULL | Fecha y hora en formato ISO 8601 UTC |
| `ground_truth` | INTEGER NOT NULL | Condición real: 1 = Presencia, 0 = Ausencia |
| `detected_presence` | INTEGER NOT NULL | Detección del método: 1 = Presencia, 0 = Ausencia |
| `is_correct` | INTEGER NOT NULL | 1 si `ground_truth == detected_presence`, sino 0 |
| `latency_ms` | REAL NOT NULL | Tiempo de latencia registrado en milisegundos |
| `score` | REAL | Puntuación continua del clasificador (0.0 a 1.0) |
| `notes` | TEXT | Anotaciones experimentales del operador |

### Tabla: `experiments`
Agrupa campañas o sesiones experimentales en laboratorio.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | ID del experimento |
| `name` | TEXT NOT NULL | Nombre descriptivo (ej. "Ensayos Sala Laboratorio M1") |
| `case_id` | TEXT NOT NULL | Caso asignado |
| `started_at` | TEXT NOT NULL | Inicio de sesión ISO |
| `ended_at` | TEXT | Finalización ISO |
| `environment` | TEXT | Condiciones ambientales (ej. "Línea de visión libre, 1 persona") |
| `notes` | TEXT | Observaciones |

---

## 2. Esquemas de Memoria Volátil (Streaming O(1))

Para evitar latencias de I/O en disco durante la graficación en tiempo real, el backend utiliza un buffer circular implementado con `collections.deque(maxlen=500)`:

- `_raw_buffers[case_id]`: Array FIFO de `SignalPoint { timestamp, value }`.
- `_filtered_buffers[case_id]`: Array FIFO de `SignalPoint` tras el pipeline de filtrado.
- `_current_statuses[case_id]`: Snapshot instantáneo del estado de conexión, presencia y latencia.

---

## 3. Modelo de Métricas de Evaluación

Para cada caso se calcula:

- **Total de ensayos ($N$)**: $\text{TP} + \text{TN} + \text{FP} + \text{FN}$
- **Detecciones Correctas**: $\text{TP} + \text{TN}$
- **Tasa de Detección (Accuracy)**:
  $$\text{Tasa} = \frac{\text{TP} + \text{TN}}{N} \times 100\%$$
- **Falsos Positivos (FP)**: Presencia detectada cuando la habitación estaba vacía.
- **Falsos Negativos (FN)**: Ausencia indicada habiendo presencia humana real.
- **Latencia Media**: Media aritmética del tiempo de reacción extremo a extremo.
