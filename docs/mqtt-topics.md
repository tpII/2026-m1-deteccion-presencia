# Mensajes MQTT

Mosquitto escucha en el puerto 1883. El backend se suscribe a estos tres tópicos:

| Tópico | `case_id` | Datos |
| --- | --- | --- |
| `presence/pir/telemetry` | `pir` | Salida digital PIR. |
| `presence/csi/router/raw` | `csi_router` | Amplitudes capturadas del router. |
| `presence/csi/dedicated/raw` | `csi_dedicated` | Amplitudes del enlace entre ESP32. |

El `case_id` debe coincidir con el tópico. Los mensajes que no cumplen el esquema se descartan y se informa el error en consola.

## PIR

El firmware incluido publica cada 500 ms nominales, con QoS 0 y sin retain:

```json
{"case_id":"pir","source":"pir-94e68605a918","presence":true,"raw_value":1}
```

`presence` indica la salida del sensor y `raw_value` vale 0 o 1. `source` identifica la placa. Si se corta la conexión, el firmware reintenta y descarta las lecturas que no pudo enviar.

## CSI

Ejemplo de formato para el receptor conectado al router:

```json
{"case_id":"csi_router","source":"esp32_rx","amplitudes":[22.45,23.10,21.80]}
```

Para el enlace dedicado, usar `case_id: "csi_dedicated"` y su tópico. Los valores del ejemplo ilustran el formato; no son mediciones del proyecto.

**Todavía falta el firmware CSI.** El backend actualmente procesa solo `amplitudes[0]` de cada mensaje, acumulando su serie temporal. Las demás amplitudes no se usan para decidir presencia ni se guardan en SQLite.

## Campos opcionales

- `timestamp`: hora UTC informada por el nodo. Si se omite, el esquema asigna la hora de recepción. El historial y los gráficos usan la hora de recepción del backend.
- `latency_ms`: latencia medida; por defecto 0, que en el firmware incluido significa sin medir.
- `ground_truth`: observación independiente opcional en el mensaje. Actualmente no genera ensayos automáticamente; se registran desde la web.

El backend no publica señal procesada por MQTT ni consume un tópico de estado. Envía resultados a React por REST y `/ws/telemetry`. Tampoco envía comandos de configuración: los parámetros PIR se editan en `firmware/pir/include/config.h` antes de cargar la placa.

Para observar mensajes reales desde otra terminal:

```bash
mosquitto_sub -h localhost -p 1883 -t 'presence/#' -v
```

La ESP32 debe usar la IP LAN de la computadora como dirección del broker. `localhost` en la placa apuntaría a la propia ESP32.
