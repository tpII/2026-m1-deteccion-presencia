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

### Firmware PIR mínimo incluido

`firmware/pir_mqtt/pir_mqtt.ino` publica cada 200 ms en este tópico, con QoS 0 y sin retain:

```json
{"case_id":"pir","source":"pir-94e68605a918","presence":true,"raw_value":1}
```

`timestamp` se puede omitir: FastAPI usa su hora de recepción. Si se omite `latency_ms`,
su valor por defecto es 0 (no medido). El firmware no calcula latencia física ni ground truth.
Ante cortes de Wi-Fi/MQTT reintenta la conexión y descarta las lecturas que no pudo enviar.
Los nodos CSI físicos todavía no tienen firmware en el repositorio.

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

## 6. Tópicos de Configuración y Control de Nodos ESP32

Emitidos por el backend hacia los nodos para ajustar parámetros de radiofrecuencia y muestreo en tiempo real.

El firmware PIR mínimo no se suscribe a estos comandos. Sus parámetros se definen
en `config.h` y requieren recompilar y cargar la placa; no se aplican desde la web.

### `presence/nodes/pir/config`
```json
{
  "node_id": "esp32_pir_node_01",
  "gpio_pin": 27,
  "trigger_mode": "RISING",
  "debounce_ms": 3000,
  "sample_interval_ms": 200,
  "mqtt_topic": "presence/pir/telemetry"
}
```

### `presence/nodes/csi_router/config`
```json
{
  "node_id": "esp32_csi_sta_node",
  "wifi_channel": 6,
  "target_ssid": "Laboratorio-WiFi",
  "sampling_rate_hz": 20,
  "subcarriers_mode": "PRIMARY",
  "mqtt_topic": "presence/csi/router/raw"
}
```

### `presence/nodes/csi_dedicated/config`
```json
{
  "node_id": "esp32_dedicated_pair",
  "wifi_channel": 1,
  "tx_power_dbm": 16,
  "packet_rate_hz": 40,
  "custom_bssid": "02:00:00:00:00:01",
  "mqtt_topic": "presence/csi/dedicated/raw"
}
```

---
