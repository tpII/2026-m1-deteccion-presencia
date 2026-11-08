# Mensajes MQTT

El contrato de entrada está definido en `backend/app/constants.py`, `backend/app/mqtt.py` y `backend/app/schemas/telemetry.py`. Mosquitto distribuye mensajes; FastAPI se suscribe y React recibe los resultados por REST y WebSocket.

## Qué está conectado hoy

| Caso | Publicador disponible | Entrada del backend |
| --- | --- | --- |
| PIR | `firmware/pir/`: JSON por MQTT y texto de diagnóstico por Serial. | `sensores/pir/presencia` |
| CSI con router | `firmware/csi_router/`: captura Wi-Fi y publicación de amplitudes por MQTT. | `sensores/csi/amplitudes` |
| Caso 3 conjunto | Reutiliza las placas PIR y CSI con router. | Los dos tópicos anteriores; no hay un tópico conjunto. |
| Dedicado histórico | Contrato retenido por compatibilidad, fuera de la web actual. | `sensores/csi/dedicado/amplitudes` |

El CSV de `prueba_CSI/` no es el JSON que acepta el backend. Abrir su monitor no alimenta el dashboard. Para publicar en vivo se usa `firmware/csi_router/`; para reproducir una grabación se usa `prueba_CSI/analisis/reproducir_log_mqtt.py`. Su funcionamiento está explicado en [prueba_CSI/README.md](../prueba_CSI/README.md).

## Tópicos y validación

| Tópico | `case_id` obligatorio | Campos de datos obligatorios |
| --- | --- | --- |
| `sensores/pir/presencia` | `pir` | `presence`, `raw_value` |
| `sensores/csi/amplitudes` | `csi_router` | `amplitudes` |
| `sensores/csi/dedicado/amplitudes` | `csi_dedicated` | `amplitudes` |

La suscripción solicita QoS 0 para estos tres tópicos de muestras y QoS 1 para los dos tópicos de conexión descritos abajo. Un tópico desconocido se ignora. Un JSON inválido, campos obligatorios ausentes o un `case_id` distinto del indicado en la tabla se rechazan y se registran en consola. Los campos adicionales no definidos por el esquema se ignoran.

Las latencias deben ser finitas y no negativas. Las amplitudes deben formar una lista no vacía de números finitos; el esquema no impone que sean positivas. Los modelos Pydantic admiten algunas conversiones de tipos: los ejemplos usan booleanos y números JSON para evitar depender de ellas.

## Estado de conexión de las ESP32

| Tópico | Placa | Payload | QoS | Retain |
| --- | --- | --- | --- | --- |
| `sensores/pir/estado_esp32` | PIR | `online` / `offline` | 1 | `true` |
| `sensores/csi/estado_esp32` | CSI con router | `online` / `offline` | 1 | `true` |

Los payloads son texto plano, en minúsculas y sin comillas JSON. El firmware registra antes de conectarse una **última voluntad (LWT)** `offline`, con QoS 1 y retain. Después de cada conexión publica `online` con los mismos parámetros y espera la confirmación del broker; si falla, cierra la conexión y reintenta. Ambos tópicos retienen el último estado para los suscriptores nuevos, incluido un backend que se reinicia.

Si se corta la alimentación, Wi-Fi o TCP sin un cierre MQTT normal, Mosquitto publica la última voluntad. No siempre es inmediato: el keepalive de las placas es de 15 segundos y el broker puede detectar la falta de tráfico al cumplirse 1,5 veces ese intervalo. Si se agrega un apagado programado con `DISCONNECT`, debe publicarse y confirmarse `offline` antes de desconectar, porque ese cierre cancela la última voluntad.

Los dos proyectos usan `256dpi/MQTT@2.5.2` porque PubSubClient solo permite publicar muestras con QoS 0. Las muestras conservan QoS 0 y `retain=false`; únicamente los mensajes de conexión usan QoS 1 y retain. QoS 1 puede entregar duplicados: asignar varias veces `online` u `offline` no cambia el resultado ni incrementa contadores de muestras. Ver [Arduino MQTT](https://github.com/256dpi/arduino-mqtt/tree/v2.5.2) y [especificación MQTT 3.1.1](https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html).

El backend aplica estos estados a `is_connected` en REST y WebSocket, sin cambiar presencia, gráficos, historial, `last_updated` ni `total_samples`. `online` indica conexión MQTT de la placa, no garantiza que el sensor esté generando muestras. `offline` tiene prioridad aunque llegue una muestra tardía. Si el backend pierde el broker, todos los casos se muestran desconectados hasta recuperar la conexión y recibir nuevamente un estado o una muestra.

El reproductor `reproducir_log_mqtt.py` usa el mismo tópico de estado CSI: anuncia `online`, registra última voluntad y confirma `offline` antes de un cierre normal. Debe ejecutarse con la placa CSI desconectada, porque ambos comparten tópicos. Para publicadores anteriores y el caso dedicado histórico, sin estado explícito se conserva la estimación por muestras recientes (10 segundos). El Caso 3 conjunto reutiliza los estados de PIR y CSI con router: no tiene otra ESP32 ni un tópico de conexión propio. Se admite una placa por método, igual que para las muestras; dos placas que compartan tópico sobrescribirían su estado.

El broker local tiene `persistence false`: retain se conserva mientras Mosquitto siga ejecutándose, no tras reiniciarlo. Las placas reintentan y vuelven a publicar `online` al reconectarse. Para aplicar este contrato hay que recompilar y cargar ambos firmwares.

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

El Caso 3 muestra las fuentes `pir` y `csi_router` separadas. `csi_dedicated` es solo el contrato histórico del enlace dedicado y no identifica al caso conjunto.

`firmware/csi_router/` publica aproximadamente 10 veces por segundo la amplitud de 55 subportadoras HT-LTF (k = −28 … 28, excluyendo 0 y 1). El backend usa el vector completo para calcular los indicadores de movimiento y forma. El gráfico crudo y SQLite guardan la amplitud media de cada paquete.

El firmware convierte los pares imaginario-real a amplitudes antes de publicar; el backend no interpreta tramas CSV `CSI_DATA` ni bytes CSI originales. El orden y la cantidad de subportadoras deben mantenerse entre mensajes; si cambia la cantidad después de calibrar, el detector invalida la calibración. Ver [signal-processing.md](signal-processing.md).

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

- El estado en memoria conserva hasta 500 puntos por caso; REST de telemetría en vivo y cada mensaje WebSocket incluyen los últimos 100 puntos crudos y hasta 300 puntos de cada indicador CSI.
- `/ws/telemetry` envía `initial_state` al conectar y `telemetry_batch` aproximadamente cada 120 ms mientras haya clientes, aunque no hayan llegado muestras nuevas. La frecuencia de difusión no es la de adquisición.
- `total_samples` cuenta mensajes procesados en la sesión; no es el total de filas histórico. La conexión se obtiene del tópico `estado_esp32`; sin estado explícito se estima por muestras de menos de 10 segundos. Perder la conexión con el broker invalida ambas fuentes hasta que se reciban mensajes nuevos.
- La cola SQLite se vacía aproximadamente cada 2 segundos, al consultar el historial de telemetría y durante el cierre normal. Difusión y escritura son independientes; no hace falta leer SQLite para actualizar el gráfico.
- La API de historial es `/api/v1/telemetry/{case_id}/history`, con `limit` entre 1 y 500, predeterminado 50. Métricas y ensayos usan `/api/v1/metrics`.
- El backend no publica resultados ni comandos por MQTT. El navegador no se suscribe a Mosquitto. La web inicia la calibración del detector CSI en el backend; no cambia la configuración del firmware.

El formato de almacenamiento y las métricas están en [data-model.md](data-model.md). La tabla USB y sus endpoints son históricos; la pantalla de adquisición USB se retiró.

## Broker y diagnóstico

`mosquitto/mosquitto.conf` escucha en `0.0.0.0:1883`, sin autenticación y sin persistencia del broker. `MQTT_HOST` y `MQTT_PORT` de `.env` configuran el cliente del backend; no cambian ese archivo ni la configuración compilada de la ESP32.

`start.sh` y `start.bat` preparan dependencias y reutilizan un broker que responda. Si el host es `localhost` o `127.0.0.1` y no responde, instalan Mosquitto cuando hace falta e intentan iniciarlo. Para un puerto local distinto de 1883 generan una configuración en `.runtime/`. Un broker remoto debe iniciarse en su equipo. Ver [arranque](arranque.md).

Con la configuración local predeterminada, para observar mensajes:

```bash
mosquitto_sub -h localhost -p 1883 -t 'sensores/#' -v
```

Si el broker es otro, ajustar host y puerto. En la ESP32, `MQTT_HOST` debe ser la dirección del broker accesible desde la placa, normalmente la IP LAN de la computadora. `localhost` apuntaría a la propia ESP32. Los parámetros PIR se editan en `firmware/pir/include/config.h` y requieren recompilar y cargar la placa.
