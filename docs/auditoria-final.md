# Auditoría final — 24 de octubre de 2026

## Resultado

El software comprobado funciona en los escenarios ensayados y su recorrido principal es legible. No corresponde afirmar que el proyecto experimental está terminado: faltan los firmware CSI y la validación física, y no se pudo realizar una revisión visual en navegador real.

La auditoría incluyó código, configuración, instalación limpia, comunicaciones reales entre procesos, persistencia, componentes React y compilación del firmware. Se trabajó sobre los cambios locales existentes.

## Problemas encontrados y corregidos

| Problema reproducido | Corrección | Comprobación |
| --- | --- | --- |
| El backend no arrancaba si la terminal heredaba `DEBUG=release` de otra herramienta. Las pruebas anteriores lo ocultaban sobrescribiendo `DEBUG=false`. | La opción propia pasa a llamarse `APP_DEBUG`. Se actualizó `.env.example` y ya no se necesita el prefijo de ejecución. | Test de configuración con `DEBUG=release` y `APP_DEBUG` verdadero/falso; arranque real; pruebas en entorno vacío. |
| Un fallo al enviar un lote WebSocket retiraba el cliente del registro sin cerrar el transporte. El navegador podía conservar el canal abierto sin nuevas muestras. | El servidor cierra la conexión con fallo, con tiempo de espera limitado, para que el cliente pueda reconectar. | Test de cierre tras fallo y test que verifica que un cliente lento no retrase a otro. |
| npm informó cinco dependencias afectadas, incluidas dos de severidad alta. | Se actualizaron Vite y source-map-js; ECharts pasó a 6.1.0 y React Router a 7.18.4. Se conserva React 18 y la API declarativa de rutas. El lockfile registra las versiones. | Instalación con `npm ci`, auditoría npm sin vulnerabilidades reportadas, TypeScript, build y tests React. |
| Las comprobaciones anteriores del frontend cubrían USB y el cliente WebSocket, pero no los formularios ni componentes. | Se añadieron pruebas con jsdom y gráficos SVG reales de ECharts. | Las siete rutas cargan en StrictMode; se comprueban consultas, formulario, telemetría, etiquetas y señales CSI. |

En ECharts 6 se utiliza el tema de compatibilidad v5 y se registra `LegacyGridContainLabel` para conservar el manejo anterior de etiquetas. Referencia: [guía oficial de migración](https://echarts.apache.org/handbook/en/basics/release-note/v6-upgrade-guide/).

`APP_DEBUG` reemplaza a la opción antigua `DEBUG`. Si se desea habilitar el registro de accesos, se debe definir `APP_DEBUG=true` en `.env`. No se modificaron las credenciales ni los datos de las configuraciones privadas.

## Evidencia de ejecución

| Comprobación | Resultado |
| --- | --- |
| Backend: `backend/.venv/bin/python -m pytest -q` | 53 tests aprobados. |
| Frontend: `npm --prefix frontend test` | 27 tests aprobados. |
| Integración: arranque y transmisión por los tres tópicos | 3 tests aprobados. |
| Integración: ráfaga y recuperación tras reinicios | 1 test aprobado. |
| Frontend reinstalado desde `package-lock.json` con `npm ci` | Instalación aprobada, sin vulnerabilidades reportadas por npm. |
| Backend instalado desde `requirements.txt` en un entorno temporal vacío | 53 tests aprobados; recuperación MQTT/WebSocket aprobada también en ese entorno. |
| TypeScript y build web | Aprobados. |
| Firmware PlatformIO, `upesy_wroom` | Compilación aprobada. 44832 bytes de RAM y 748725 bytes de flash. |
| Sintaxis de `start.sh`, espacios del diff, imports Python y enlaces locales de las guías | Sin problemas detectados. |
| Configuración privada, base de datos y artefactos PlatformIO | `.env`, `include/config.h` y `.pio/` están excluidos de Git. |

Son 84 pruebas diferentes: 53 de backend, 27 de frontend y 4 de integración. La repetición en el entorno limpio no se cuenta como pruebas adicionales. La ejecución se realizó en macOS, con Python 3.13 y Node 24; no constituye una matriz de pruebas de todos los sistemas y versiones admitidos.

## Qué se probó

- Validación de mensajes, identificadores y límites de consultas; ensayos, métricas y almacenamiento USB.
- Fallo de escritura y reintento sin perder el lote; muestras que llegan durante una escritura y vaciados simultáneos.
- Canales WebSocket, heartbeat, reconexión, estados de sensores y cierre.
- Ráfaga de 180 muestras: 120 PIR, 30 CSI con router y 30 CSI dedicado. Dos clientes reciben los contadores esperados, el mensaje limita a 100 puntos el gráfico y SQLite conserva las muestras.
- Reinicio real de Mosquitto, reconexión automática y recepción de una muestra adicional.
- Reinicio real del backend: el historial conserva 121 lecturas PIR y el ensayo registrado; los contadores de sesión vuelven a cero.
- Formulario de ensayos: latencia inválida, HTTP 503, estado de guardado y prevención de doble envío.
- Consultas React: cancelación al cambiar de caso, rechazo de resultados viejos y recuperación después de un error.
- Las siete rutas React, telemetría compartida y gráficos con datos, incluidos métodos con ensayos parciales.

Los gráficos de estas pruebas usan SVG a tamaño fijo dentro de jsdom. Se ejercitan componentes, opciones y datos reales de la aplicación, con HTTP y WebSocket controlados por el test. Esto no verifica la distribución visual ni el comportamiento físico de un navegador o un puerto USB.

## Lectura y mantenimiento

Con bases de Python y React se puede seguir una muestra sin conocer todo el repositorio. La adquisición, validación, estado, persistencia y presentación están separadas en archivos concretos. Los cambios habituales, como pin, intervalo, textos o formulario, tienen un punto inicial identificable.

La asíncronía del servidor, el cruce entre el hilo MQTT y el bucle de FastAPI, y la matemática CSI requieren conocimientos adicionales. No sería honesto prometer comprensión completa desde cero sólo por haber eliminado comentarios.

Se añadió [una guía de lectura paso a paso](recorrido-codigo.md) y [la explicación de las pruebas](pruebas-automaticas.md). La documentación explica el recorrido y las decisiones; el código mantiene nombres y responsabilidades explícitos.

## Pendientes y límites

- **Hardware:** compilación no equivale a carga y medición. Falta comprobar la ESP32, PIR, Wi-Fi y comportamiento físico con presencia observada.
- **CSI:** faltan los firmware de captura. El procesamiento utiliza la primera amplitud del mensaje; los umbrales y las etiquetas heurísticas requieren calibración y validación experimental. Las pruebas de software no prueban exactitud física.
- **Interfaz visual:** el control de Chrome fue rechazado porque no están concedidos los permisos de uso del equipo. Quedan pendientes revisión visual, tamaños móviles y navegación con teclado en un navegador real.
- **Avisos de herramientas:** Vite informa que el JavaScript generado supera 500 kB; el paquete final mide aproximadamente 821 kB, unos 275 kB comprimidos. El TestClient instalado emite avisos de deprecación. No son fallos de las pruebas, pero siguen presentes.
- **Persistencia:** el guardado periódico tiene una cola en memoria. Se probaron errores de escritura y apagado normal; una interrupción abrupta del proceso puede perder las muestras que todavía no se confirmaron en SQLite.

No se cargó firmware en dispositivos ni se utilizaron las bases con mediciones para estas pruebas.
