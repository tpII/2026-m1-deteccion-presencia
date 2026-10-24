# Mensajes MQTT

El contrato de entrada está definido en `backend/app/constants.py`, `backend/app/mqtt.py` y `backend/app/schemas/telemetry.py`. Mosquitto distribuye mensajes; FastAPI se suscribe y React recibe los resultados por REST y WebSocket.

## Qué está conectado hoy

| Caso | Publicador disponible | Entrada del backend |
| --- | --- | --- |
| PIR | `firmware/pir/`: JSON por MQTT y texto de diagnóstico por Serial. | `presence/pir/telemetry` |
| CSI con router | `prueba_CSI/`: captura por Wi-Fi y salida CSV por Serial; **no publica MQTT**. | `presence/csi/router/raw`, preparado para recibir amplitudes. |
| CSI dedicado | No hay firmware del emisor AP ni del receptor Station. | `presence/csi/dedicated/raw`, preparado para recibir amplitudes. |

El CSV de `prueba_CSI/` no es el JSON que acepta el backend. Todavía no hay un adaptador que transforme esa captura y la publique en MQTT. Encender ese receptor o abrir su monitor no alimenta el dashboard. Su funcionamiento está explicado en [prueba_CSI/README.md](../prueba_CSI/README.md).

## Tópicos y validación

| Tópico | `case_id` obligatorio | Campos de datos obligatorios |
| --- | --- | --- |
| `presence/pir/telemetry` | `pir` | `presence`, `raw_value` |
| `presence/csi/router/raw` | `csi_router` | `amplitudes` |
| `presence/csi/dedicated/raw` | `csi_dedicated` | `amplitudes` |

La suscripción solicita QoS 0 para los tres tópicos. Un tópico desconocido se ignora. Un JSON inválido, campos obligatorios ausentes o un `case_id` distinto del indicado en la tabla se rechazan y se registran en consola. Los campos adicionales no definidos por el esquema se ignoran.

Las latencias deben ser finitas y no negativas. Las amplitudes deben formar una lista no vacía de números finitos; el esquema no impone que sean positivas. Los modelos Pydantic admiten algunas conversiones de tipos: los ejemplos usan booleanos y números JSON para evitar depender de ellas.

## PIR

El firmware publica cada 500 ms nominales, según `SAMPLE_INTERVAL_MS` de su configuración, con QoS 0 y `retain=false`:

```json
{"case_id":"pir","source":"pir-94e68605a918","presence":true,"raw_value":1}
```

`presence` representa el nivel alto del PIR, no una observación independiente de que haya una persona. El firmware envía `raw_value=1` para movimiento y `raw_value=0` para ausencia de movimiento. Publica cada muestra, aunque el estado no cambie.

El backend utiliza `presence` para el estado y `raw_value` para el gráfico y el historial. Actualmente valida que `raw_value` sea finito, pero **no exige 0/1 ni comprueba su coherencia con `presence`**. El publicador debe mantener esa correspondencia.

`source` identifica la placa, pero el backend agrupa las muestras por `case_id`, no por placa. Dos publicadores PIR mezclarían sus lecturas en la misma serie. `source` no se guarda en SQLite ni se transmite a React.

Si no hay Wi-Fi o broker, la lectura sigue saliendo por Serial cuando el bucle la toma. Las muestras no publicadas no se conservan para reenvío. Los intentos de reconexión pueden demorar el intervalo nominal; QoS 0 no confirma entrega al backend ni persistencia.

## CSI

Ejemplo del formato aceptado para el caso con router; sus números ilustran el contrato y no son mediciones del proyecto:

```json
{"case_id":"csi_router","source":"esp32_rx","amplitudes":[22.45,23.10,21.80]}
```

Para el enlace dedicado se usa `case_id: "csi_dedicated"` en su tópico correspondiente.

El backend toma **sólo `amplitudes[0]` de cada mensaje** y acumula esos valores en una serie temporal por caso. El resto del vector se valida, pero no se utiliza para decidir presencia ni se guarda en SQLite. El publicador debe mantener el significado y la escala de esa primera amplitud entre mensajes; no enviar los bytes imaginario-real del CSV como si ya fueran amplitudes.

La selección de datos de captura y su conversión a este formato siguen pendientes de integración. El backend no interpreta tramas `CSI_DATA`, no calcula amplitudes a partir de pares imaginario-real y no descarta bytes mediante `first_word_invalid`. Los filtros y umbrales que sí ejecuta están en [signal-processing.md](signal-processing.md).

## Campos opcionales y uso real

| Campo | Si se omite | Qué hace el backend |
| --- | --- | --- |
| `source` | `hardware` en PIR; `esp32` en CSI. | Lo valida como texto, pero no lo persiste ni lo expone a React. |
| `timestamp` | Asigna una cadena de hora UTC al validar el mensaje. | No utiliza la hora del nodo para ordenar o guardar. Si se envía, sólo exige texto; no valida su formato ISO ni zona horaria. |
| `latency_ms` | `0`. | Lo guarda y muestra; no mide ni calcula la latencia de adquisición o transporte. En las tarjetas en vivo, cero se muestra como «Sin medir». |
| `ground_truth` | `null`. | Lo acepta, pero no lo incorpora al estado, al historial ni a los ensayos. Se registra la presencia observada desde el formulario o REST. |

Los gráficos usan la hora del backend al procesar la muestra, en milisegundos desde la época Unix. `last_updated` se asigna al actualizar el estado; el historial SQLite asigna otra hora UTC al encolar la fila. Son marcas de procesamiento del backend, no la hora del ESP32 ni el momento del commit de SQLite.

El firmware PIR incluido no envía `timestamp`, `latency_ms` ni `ground_truth`. El timestamp de radio que imprime `prueba_CSI/` es otro dato: microsegundos locales del dispositivo, no una fecha UTC.

## Del backend a la web y a SQLite

- El estado en memoria conserva hasta 500 puntos por caso; REST de telemetría en vivo y cada mensaje WebSocket incluyen los últimos 100.
- `/ws/telemetry` envía `initial_state` al conectar y `telemetry_batch` aproximadamente cada 120 ms mientras haya clientes, aunque no hayan llegado muestras nuevas. La frecuencia de difusión no es la de adquisición.
- `total_samples` cuenta mensajes procesados en la sesión; no es el total de filas histórico. Un caso se marca conectado si tiene muestras y la última actualización tiene menos de 10 segundos.
- La cola SQLite se vacía aproximadamente cada 2 segundos, al consultar el historial de telemetría y durante el cierre normal. Difusión y escritura son independientes; no hace falta leer SQLite para actualizar el gráfico.
- La API de historial es `/api/v1/telemetry/{case_id}/history`, con `limit` entre 1 y 500, predeterminado 50. Métricas y ensayos usan `/api/v1/metrics`.
- El backend no publica resultados ni comandos por MQTT. El navegador no se suscribe a Mosquitto. No existe configuración remota del firmware desde la web.

El formato de almacenamiento y las métricas están en [data-model.md](data-model.md). La prueba USB usa su tabla y guardado manual, separados del flujo MQTT.

## Broker y diagnóstico

`mosquitto/mosquitto.conf` escucha en `0.0.0.0:1883`, sin autenticación y sin persistencia del broker. `MQTT_HOST` y `MQTT_PORT` de `.env` configuran el cliente del backend; no cambian ese archivo ni la configuración compilada de la ESP32.

`start.sh` reutiliza el broker si su dirección y puerto responden. Sólo inicia Mosquitto automáticamente si está configurado en `localhost` o `127.0.0.1`, puerto `1883`. Para otro host o puerto hay que iniciar y configurar ese broker por separado.

Con la configuración local predeterminada, para observar mensajes:

```bash
mosquitto_sub -h localhost -p 1883 -t 'presence/#' -v
```

Si el broker es otro, ajustar host y puerto. En la ESP32, `MQTT_HOST` debe ser la dirección del broker accesible desde la placa, normalmente la IP LAN de la computadora. `localhost` apuntaría a la propia ESP32. Los parámetros PIR se editan en `firmware/pir/include/config.h` y requieren recompilar y cargar la placa.
