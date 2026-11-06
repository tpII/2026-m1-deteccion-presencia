# Pruebas automáticas

Todos los comandos parten de la raíz del repositorio. El arranque `./start.sh` o `.\start.bat` prepara dependencias. Detener la instancia antes de probar un arranque con los mismos puertos. Los tests del backend utilizan bases temporales y no escriben mediciones en las bases del proyecto.

## Backend

```bash
backend/.venv/bin/python -m pytest
```

Comprueba validación, consultas REST, cálculos del detector CSI, calibración, almacenamiento USB histórico, lotes SQLite, estado de sensores y WebSocket. `test_audit_regressions.py` comprueba que la variable `DEBUG` de otras herramientas no impida arrancar, que los clientes WebSocket con fallos se cierren y que un cliente lento no frene a los demás.

`test_module_size.py` comprueba que todos los módulos propios tengan menos de 200 líneas físicas: backend, frontend, CSS, firmware, análisis, scripts de arranque y pruebas. No cuenta dependencias, informes, grabaciones ni archivos generados.

La configuración propia de depuración es `APP_DEBUG`, definida en `.env.example`. No hace falta sobrescribir `DEBUG` para ejecutar las pruebas.

## Frontend

```bash
npm --prefix frontend test
npm --prefix frontend run build
```

- `websocket.test.mjs` comprueba heartbeat, reconexión y suscripciones.
- `react.test.mjs` comprueba consultas canceladas, formularios, errores HTTP, envíos duplicados, conexión compartida y etiquetas del gráfico comparativo.
- `routes.test.mjs` comprueba las rutas, redirecciones, indicadores CSI y el botón de calibración.
- `joint.test.mjs` comprueba el caso conjunto con dos fuentes, una sola fuente, desconexión, calibración compartida y exclusión del caso dedicado en formularios y comparación.

Los tres archivos reutilizan `reactHarness.mjs` para montar componentes reales en jsdom y cerrar cada montaje y servidor al terminar.

El test React carga TypeScript mediante Vite, con observadores y puertos de desarrollo deshabilitados. Sustituye sólo la inicialización gráfica: usa el renderer SVG de ECharts a 800 × 300 en lugar de Canvas. Las opciones del gráfico, los componentes, hooks y efectos son los del proyecto. HTTP y WebSocket se controlan desde cada test.

Esto verifica comportamiento y contenido, pero no sustituye una revisión visual de CSS, navegación con teclado o tamaños móviles en un navegador real.

## Servicios reales

Requiere Mosquitto instalado y permiso para abrir puertos locales:

```bash
RUN_MQTT_INTEGRATION=1 backend/.venv/bin/python -m pytest tests/integration
```

`test_startup.py` comprueba el script de arranque, los dos tópicos activos y el tópico dedicado histórico, REST, WebSocket y el cierre de procesos. Usa los puertos 1883, 8000 y 5173; omite la prueba si encuentra servicios activos para no detenerlos.

`test_recovery.py` usa puertos locales libres y una base temporal. Publica una ráfaga de 180 muestras para las dos fuentes activas y el contrato dedicado histórico, verifica dos clientes WebSocket, reinicia Mosquitto y comprueba la reconexión. Después reinicia el backend y verifica que el historial y el ensayo registrado sigan guardados, mientras los contadores de la sesión vuelven a cero.

`test_bootstrap.py` prepara una copia aislada, crea un entorno Python y ejecuta el arranque dos veces con puertos libres. Comprueba MQTT, backend, frontend, reutilización de dependencias y conservación del historial. Reutiliza los paquetes disponibles para no descargar herramientas del sistema durante la prueba.

## Firmware

```bash
pio run --project-dir firmware/pir
```

Estos comandos compilan únicamente el firmware PIR. La captura CSI por Serial se encuentra en [prueba_CSI/](../prueba_CSI/README.md) y tiene su propio proyecto PlatformIO; las pruebas MQTT no ejecutan ese firmware.

Compilar no carga la placa ni demuestra que el sensor o la red física funcionen. La comprobación física está en [pruebas.md](pruebas.md).

## Preparación automática

`test_setup_scripts.py` usa ejecutables controlados para verificar preparación inicial, reutilización, cambios de requisitos, conservación de `.env` y fallos de instalación. No instala herramientas del sistema en el equipo durante esos tests. La prueba real del arranque se ejecuta en una copia aislada y con una base temporal; la instalación completa en Windows requiere además una comprobación en ese sistema.

La validación del 31/10 obtuvo 61 pruebas de backend, 22 de frontend y 2 de integración aprobadas. Las tres variantes con puertos fijos se omitieron por servicios existentes; la prueba aislada y la recuperación usaron puertos libres. La compilación del frontend pasó. Esto no verifica la instalación de herramientas en un sistema operativo limpio ni la ejecución de PowerShell en Windows.

## Validación de la limpieza modular — 2/11/2026

- Se verificaron 135 módulos propios: todos tienen menos de 200 líneas físicas; el mayor tiene 170. La comprobación incluye los archivos nuevos y los scripts de Windows.
- Aprobaron 62 pruebas de backend, 22 de frontend y las 5 de integración con servicios reales. También pasó la compilación de producción del frontend.
- Chromium comparó los estilos anteriores y posteriores de las seis pantallas, a 1440 y 390 píxeles, con temas claro y oscuro: 24 combinaciones sin diferencias en las propiedades de estilo comprobadas ni errores JavaScript. Se estabilizaron fuentes y reloj para la comparación; HTTP y WebSocket estaban controlados por la prueba.
- El análisis del log `ensayo_movimientos_24.10_device-monitor-261024-171800.log`, con `--vacio 1 --caminando 2 --sentado 3`, produjo el mismo `resumen.txt` y las mismas dos imágenes, byte por byte, antes y después de separar las figuras en `csi_plots.py`.
- La captura Serial CSI compiló con PlatformIO, placa `esp32doit-devkit-v1`, Espressif32 8.0.0 y Arduino 3.3.12. Se utilizó una copia temporal con la configuración de ejemplo: no se cargaron placas ni se midió el ambiente.
- PowerShell 7.4.6 en macOS validó la sintaxis de ambos scripts y probó `Prepare-Dependencies` con instalaciones simuladas: ruta de retorno única, instalación inicial, reutilización, conservación de `.env`, fallo sin marca de éxito y recuperación. La instalación de programas y el arranque completo en Windows siguen requiriendo una prueba en ese sistema.

Se conservaron el historial USB y el contrato dedicado del backend por compatibilidad. La limpieza retiró código y estilos sin consumidores, plantillas genéricas de PlatformIO y la referencia al favicon de Vite inexistente; no borró grabaciones, bases ni informes históricos.
