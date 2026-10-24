# Cómo leer y modificar el proyecto

Empezá por el README para ejecutarlo y después seguí una muestra PIR. No hace falta comprender los filtros CSI para trabajar con el sensor PIR o las pantallas.

## Seguir una lectura del PIR

1. `firmware/pir/src/main.cpp` lee GPIO27. `motion` vale `true` si el pin está en alto. Imprime el estado por USB y llama a `publishPresence`.
2. `firmware/pir/src/network.cpp` mantiene Wi-Fi y MQTT. Publica un mensaje en `presence/pir/telemetry`:

   ```json
   {"case_id":"pir","source":"pir-0123456789ab","presence":true,"raw_value":1}
   ```

3. Mosquitto entrega ese mensaje a `backend/app/mqtt.py`. Este módulo selecciona el esquema según el tópico, valida el JSON y rechaza un `case_id` que no corresponda.
4. `backend/app/telemetry.py` recibe la muestra validada. Para PIR utiliza directamente la presencia recibida; para CSI ejecuta el pipeline.
5. `backend/app/telemetry_state.py` conserva las señales recientes y el estado de cada método. `repositories/telemetry_repository.py` acumula las filas que se escribirán en SQLite.
6. Hay dos tareas periódicas independientes: una envía actualizaciones por WebSocket y otra guarda los lotes pendientes. Una escritura fallida conserva el lote para reintentarlo.
7. `frontend/src/context/TelemetryContext.tsx` mantiene una conexión compartida. Las pantallas leen sus datos mediante `hooks/useTelemetry.ts`.
8. `pages/PirCasePage.tsx` entrega esos puntos a `components/charts/DigitalSignalChart.tsx`. El gráfico dibuja los datos; no decide si hay presencia.

## Las tres clases de datos

| Dato | Origen | Dónde se guarda | Para qué sirve |
| --- | --- | --- | --- |
| Telemetría | ESP32 por MQTT | Tabla `telemetry` y buffer en memoria | Estado en vivo e historial. |
| Lectura USB | Puerto serial de esta computadora | Tabla `pir_usb_readings`, al guardar manualmente | Diagnóstico del PIR. |
| Ensayo | Formulario con presencia observada | Tabla `trials` | Exactitud, errores y comparación. |

Guardar muchas muestras no crea ensayos. Para calcular precisión hace falta saber, de manera independiente, si había una persona.

## Dónde cambiar algo

| Quiero cambiar… | Archivo inicial |
| --- | --- |
| Pin, intervalo, red o broker de la ESP32 | `firmware/pir/include/config.h`, copiado del ejemplo. Después recompilar y cargar. |
| Dirección del broker o base del servidor | `.env` en la raíz. Después reiniciar el backend. |
| Mensaje MQTT aceptado | `backend/app/schemas/telemetry.py` y `docs/mqtt-topics.md`. Revisar también el publicador. |
| Filtros o umbral CSI | `backend/app/signal_processing/`. Los umbrales de cada caso se eligen en `telemetry.py`. |
| Fórmulas de métricas | `backend/app/repositories/metrics_repository.py`. |
| Una pantalla | `frontend/src/pages/`. |
| Colores y espacios | `frontend/src/styles/`. |
| Registro de ensayos | `frontend/src/components/system/TrialForm.tsx`. |
| Una consulta HTTP o el estado de carga | `frontend/src/services/api.ts` y `hooks/useApiQuery.ts`. |

## Qué conocimientos hacen falta

Con funciones, clases y tipos básicos de Python/TypeScript se puede seguir el recorrido anterior. Para modificar React hacen falta componentes, props, estado y efectos. Para tocar SQL, alcanza inicialmente con `SELECT`, `INSERT` y consultas con parámetros.

Las partes que requieren más estudio son la comunicación asíncrona y CSI:

- `await` espera una operación sin bloquear todo el servidor. Por eso otras conexiones pueden seguir trabajando mientras SQLite guarda.
- El cliente MQTT recibe mensajes en otro hilo. `run_coroutine_threadsafe` los entrega al bucle asíncrono del backend. Ese cruce está concentrado en `mqtt.py`.
- Un `Lock` impide ejecutar dos escrituras del mismo lote al mismo tiempo. `Event` permite pedir el cierre de las tareas sin interrumpir una escritura activa.
- `deque(maxlen=500)` conserva un historial acotado y descarta los puntos más viejos del buffer. Eso no borra el historial SQLite.
- Para cambiar la detección CSI hay que comprender ventanas, varianza, filtros y FFT. Su explicación y límites están en [signal-processing.md](signal-processing.md).

## Antes de dar un cambio por terminado

```bash
backend/.venv/bin/python -m pytest
npm --prefix frontend test
npm --prefix frontend run build
```

Si cambiaste el firmware, compilalo con PlatformIO. Si cambiaste comunicaciones o persistencia, ejecutá también `RUN_MQTT_INTEGRATION=1 backend/.venv/bin/python -m pytest tests/integration`. Las pruebas usan bases temporales.

Las pruebas React usan jsdom para comprobar comportamiento y SVG para ejercitar las opciones de ECharts. No comprueban el aspecto real en diferentes tamaños de pantalla. Los detalles están en [pruebas-automaticas.md](pruebas-automaticas.md).
