# Pruebas automáticas

Todos los comandos parten de la raíz del repositorio. Las dependencias se instalan siguiendo el README. Los tests del backend utilizan bases temporales y no escriben mediciones en las bases del proyecto.

## Backend

```bash
backend/.venv/bin/python -m pytest
```

Comprueba validación, consultas REST, cálculos, filtros, guardado USB, lotes SQLite, estado de sensores y WebSocket. `test_audit_regressions.py` comprueba que la variable `DEBUG` de otras herramientas no impida arrancar, que los clientes WebSocket con fallos se cierren y que un cliente lento no frene a los demás.

La configuración propia de depuración es `APP_DEBUG`, definida en `.env.example`. No hace falta sobrescribir `DEBUG` para ejecutar las pruebas.

## Frontend

```bash
npm --prefix frontend test
npm --prefix frontend run build
```

- `pirSerial.test.mjs` comprueba mensajes fragmentados, límites de lectura, desconexión y liberación del puerto.
- `websocket.test.mjs` comprueba heartbeat, reconexión y suscripciones.
- `react.test.mjs` monta componentes reales en jsdom. Comprueba el formulario, errores HTTP, envíos duplicados, consultas canceladas, estados de sensores, las siete rutas y gráficos alimentados por telemetría.

El test React carga TypeScript mediante Vite, con observadores y puertos de desarrollo deshabilitados. Sustituye sólo la inicialización gráfica: usa el renderer SVG de ECharts a 800 × 300 en lugar de Canvas. Las opciones del gráfico, los componentes, hooks y efectos son los del proyecto. HTTP y WebSocket se controlan desde cada test.

Esto verifica comportamiento y contenido, pero no sustituye una revisión visual de CSS, navegación con teclado o tamaños móviles en un navegador real.

## Servicios reales

Requiere Mosquitto instalado y permiso para abrir puertos locales:

```bash
RUN_MQTT_INTEGRATION=1 backend/.venv/bin/python -m pytest tests/integration
```

`test_startup.py` comprueba el script de arranque, los tres tópicos MQTT, REST, WebSocket y el cierre de procesos. Usa los puertos 1883, 8000 y 5173; omite la prueba si encuentra servicios activos para no detenerlos.

`test_recovery.py` usa puertos locales libres y una base temporal. Publica una ráfaga de 180 muestras para los tres casos, verifica dos clientes WebSocket, reinicia Mosquitto y comprueba la reconexión. Después reinicia el backend y verifica que el historial y el ensayo registrado sigan guardados, mientras los contadores de la sesión vuelven a cero.

## Firmware

```bash
cp -n firmware/pir/include/config.example.h firmware/pir/include/config.h
pio run --project-dir firmware/pir
```

Estos comandos compilan únicamente el firmware PIR. La captura CSI por Serial se encuentra en [prueba_CSI/](../prueba_CSI/README.md) y tiene su propio proyecto PlatformIO; las pruebas MQTT no ejecutan ese firmware.

Compilar no carga la placa ni demuestra que el sensor o la red física funcionen. La comprobación física está en [pruebas.md](pruebas.md).
