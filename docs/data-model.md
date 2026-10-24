# Datos y métricas

SQLite guarda tres tipos de datos. Las tablas se crean en `backend/app/database.py` sin insertar ejemplos.

| Tabla | Qué guarda | Quién la usa |
| --- | --- | --- |
| `telemetry` | Método, hora UTC asignada al encolar, presencia, señal cruda, latencia y score. | Recepción MQTT y consulta `/api/v1/telemetry/{case_id}/history`. |
| `trials` | Método, hora UTC, presencia observada, detección, acierto, latencia, score opcional y notas. | Formulario de ensayos y comparación de métodos. |
| `pir_usb_readings` | Hora de recepción y salida digital leída por USB. | Diagnóstico USB y su guardado manual. |

Cada tabla tiene un `id` autoincremental. Los métodos válidos son `pir`, `csi_router` y `csi_dedicated`. Los booleanos se guardan como 0 o 1. Una lectura USB con la misma hora y salida no se inserta dos veces.

Las bases anteriores pueden contener una tabla `experiments`: no tiene consumidores en la aplicación. Ya no se crea en bases nuevas; no se borra de bases existentes.

## Memoria y persistencia

`telemetry_state.py` conserva hasta 500 puntos por método en memoria y envía los últimos 100 por WebSocket. Al reiniciar, esos buffers y los contadores comienzan vacíos; las muestras SQLite permanecen disponibles en el historial REST.

El repositorio de telemetría escribe por lotes. Sólo retira de la cola las muestras confirmadas por SQLite; un fallo conserva el lote pendiente. El guardado periódico, aproximadamente cada 2 segundos, es independiente del envío WebSocket. Consultar el historial MQTT también vacía la cola; el cierre normal realiza un último guardado. Un cierre abrupto puede perder las filas todavía en memoria.

El historial MQTT devuelve primero las filas más nuevas por `id`; los puntos en vivo conservan el orden de procesamiento. `timestamp` del nodo, `source` y `ground_truth` no se guardan en `telemetry`. El historial guarda una sola amplitud por mensaje CSI: la primera. Las marcas de tiempo y los campos ignorados están detallados en [mqtt-topics.md](mqtt-topics.md).

La prueba USB conserva hasta 50 lecturas en el navegador y las guarda cuando se pulsa el botón. Es independiente del flujo MQTT.

## Métricas

Las métricas salen únicamente de `trials`, comparando la detección con una observación independiente:

- **TP:** detectó presencia y había una persona.
- **TN:** detectó ausencia y el ambiente estaba vacío.
- **FP:** detectó presencia con el ambiente vacío.
- **FN:** detectó ausencia cuando había una persona.
- **Exactitud (`detection_rate` en la API):** `(TP + TN) / total × 100`.
- **Precisión:** `TP / (TP + FP)`.
- **Recall:** `TP / (TP + FN)`.
- **F1:** `2 × TP / (2 × TP + FP + FN)`, calculado antes de redondear. Vale cero cuando hay errores y ningún TP; es nulo si el denominador es cero.
- **Latencia media:** promedio de las latencias introducidas al registrar los ensayos. El sistema no mide automáticamente el tiempo extremo a extremo; el grupo debe acordar y documentar el método de medición.

Sin ensayos, la web muestra «Sin ensayos». Guardar telemetría no permite calcular exactitud por sí solo. El firmware PIR omite `latency_ms`; el esquema asigna cero y las tarjetas de telemetría muestran «Sin medir». En los ensayos, una latencia igual a cero sí entra en el promedio: la API no distingue cero medido de latencia ausente. Registrar y documentar sólo latencias efectivamente medidas.
