# Especificación de Tópicos y Mensajes MQTT

Esta especificación estandariza la comunicación entre los nodos microcontroladores **ESP32** y el backend **FastAPI** a través del broker **Eclipse Mosquitto** (puerto 1883).

---

## 1. Tópico: `presence/pir/telemetry`

Publicado por el nodo ESP32 conectado al sensor PIR tras cambio de nivel lógico o intervalo de refresco.

### Formato de Mensaje (JSON)
```json
{
  "timestamp": "2026-09-18T18:30:00.120Z",
  "case_id": "pir",
  "source": "esp32_pir_node_01",
  "presence": true,
  "raw_value": 1.0,
  "latency_ms": 145.2,
  "ground_truth": true
}
```

### Campos:
- `timestamp`: Cadena ISO 8601 en tiempo UTC.
- `case_id`: Constante `"pir"`.
- `source`: Identificador del dispositivo de origen.
- `presence`: Booleano indicando detección (`true`) o reposo (`false`).
- `raw_value`: `1.0` (Active High) o `0.0`.
- `latency_ms`: Tiempo de propagación / procesamiento interno en milisegundos.
- `ground_truth`: Opcional, estado real verificado durante ensayos experimentales.

---

## 2. Tópico: `presence/csi/router/raw`

Publicado por el ESP32 receptor (Station) que captura tramas del router comercial Wi-Fi existente.

### Formato de Mensaje (JSON)
```json
{
  "timestamp": "2026-09-18T18:30:00.250Z",
  "case_id": "csi_router",
  "source": "esp32_csi_sta_node",
  "amplitudes": [22.45, 23.10, 21.80],
  "latency_ms": 318.5,
  "ground_truth": true
}
```

### Campos:
- `amplitudes`: Vector numérico con la amplitud de las subportadoras OFDM analizadas (o la magnitud de la primera subportadora de referencia).
- `latency_ms`: Latencia medida de captura y envío.

---

## 3. Tópico: `presence/csi/dedicated/raw`

Publicado por el ESP32 receptor del par dedicado (AP - STA).

### Formato de Mensaje (JSON)
```json
{
  "timestamp": "2026-09-18T18:30:00.310Z",
  "case_id": "csi_dedicated",
  "source": "esp32_dedicated_pair",
  "amplitudes": [35.20, 36.15, 34.90],
  "latency_ms": 395.0,
  "ground_truth": true
}
```

---

## 4. Tópicos de Señal Procesada:
- `presence/csi/router/processed`
- `presence/csi/dedicated/processed`

Emitidos opcionalmente por el backend hacia herramientas de telemetría de laboratorio.

```json
{
  "timestamp": "2026-09-18T18:30:00.320Z",
  "case_id": "csi_router",
  "filtered_amplitude": 22.38,
  "variance": 3.45,
  "energy": 501.2,
  "detection_score": 0.89,
  "presence": true
}
```

---

## 5. Tópico: `presence/system/status`

Heartbeat de estado del nodo físico.

```json
{
  "source": "esp32_pir_node_01",
  "state": "online",
  "rssi": -58,
  "free_heap": 184520,
  "uptime_sec": 3600
}
```

---

## Simulación de Hardware

Para simular publicaciones de hardware sin encender microcontroladores físicos:

```bash
python scripts/mqtt_test_publisher.py --host localhost --port 1883 --case all
```
