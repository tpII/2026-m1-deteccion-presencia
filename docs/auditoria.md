# Auditoría y limpieza — 15 de octubre de 2026

> **Registro histórico.** Los resultados, conteos y pendientes corresponden a las etapas auditadas, no se actualizan como si se hubieran medido otra vez. La rama actual también incluye `prueba_CSI/`, incorporado desde `main`: captura CSI del router por Serial, pero no publica MQTT. El estado vigente está en [architecture.md](architecture.md) y [mqtt-topics.md](mqtt-topics.md).

El proyecto conserva el recorrido ESP32 → MQTT → FastAPI → SQLite → React. La limpieza reduce carpetas, código sin consumidores y documentación que describía funciones inexistentes.

## Resultado

Conteo de carpetas con archivos de código, incluyendo la carpeta principal de cada bloque:

| Bloque | Antes | Después |
| --- | ---: | ---: |
| Archivos en `backend/app/` | 47 | 26 |
| Carpetas en `backend/app/` | 13 | 5 |
| Líneas en `backend/app/` | 2331 | 1561 |
| Archivos en `frontend/src/` | 49 | 43 |
| Carpetas en `frontend/src/` | 16 | 9 |
| Líneas en `frontend/src/` | 5162 | 4041 |

Además se retiraron 27 temporales de edición de informes: unos 9.6 MiB de capturas, copias previas y un script de revisión de PDF. La eliminación del árbol de trabajo no purga archivos del historial Git.

## Qué se sacó y por qué

| Elemento anterior | Motivo y resultado |
| --- | --- |
| `tmp/pdfs/` | Capturas y versiones intermedias de edición, sin uso en la aplicación. |
| `agent.md` | Copia idéntica de `AGENTS.md`; se conserva este último. |
| Panel ESP32 y generador de cabeceras | El firmware incluido no recibía sus comandos y usaba otras constantes de configuración. Se retiraron la interfaz, `/api/v1/config/*`, sus esquemas y cuatro tests de esa función. La configuración real sigue en `config.h` y `.env`. |
| `models/` | Tres dataclasses que ningún módulo utilizaba. Pydantic ya valida los datos y los repositorios usan SQLite directamente. |
| `DataSource`, `SignalFilter`, `FeatureExtractor` | Contratos abstractos innecesarios para las implementaciones actuales. MQTT y los dos filtros quedan como clases concretas. |
| `metrics_service.py` y `api/dependencies.py` | Solo reenviaban llamadas o devolvían objetos globales. Las rutas consultan directamente el módulo correspondiente. |
| Filtro Butterworth y SciPy | El pipeline nunca utilizaba ese filtro. SciPy deja de ser una dependencia requerida; no se desinstala del entorno existente. |
| Extractores de varianza y energía | Cada clase envolvía una operación NumPy. Los cálculos quedan juntos en el pipeline. |
| Esquemas WebSocket duplicados y `CsiProcessedSample` | No tenían consumidores. Se conserva el esquema de telemetría que usa realmente la aplicación. |
| Tabla `experiments` | No había lectura, escritura ni pantalla para ella. Ya no se crea en bases nuevas; no se modifica ninguna base existente. |
| `core/`, `services/`, `data_sources/`, `database/`, `api/routes/` | Se aplanaron. Los módulos quedan directamente en `app/` y las rutas en `app/api/`. |
| Subcarpetas de componentes React | Los componentes quedan directamente en `components/`, con sus imports actualizados. |
| `useTheme.ts`, métodos HTTP y registro de ensayos duplicados | Se retiraron reexportaciones y funciones que ninguna pantalla consumía. |
| `pyproject.toml` y `tsconfig.node.json` | El flujo documentado usa `requirements.txt`; el segundo tsconfig no estaba referenciado por el build. Se mantiene una configuración de tests en la raíz. |
| `scripts/reset_database.py` | Utilidad sin consumidores que borraba toda la base. Para una campaña nueva se puede configurar otro archivo SQLite en `.env`, conservando el anterior. |
| Configuración opcional de despliegue | Se eliminaron Compose, ambos Dockerfile, sus `.dockerignore` y Nginx. El proyecto se ejecuta localmente con `start.sh`. Mosquitto usa `mosquitto/mosquitto.conf`. |
| API descriptiva `/cases` y ruta `/{case_id}/pipeline` | Ninguna pantalla las consultaba. Las descripciones están en las páginas y los parámetros de filtro llegan con la telemetría. También se retiró `get_status()`, sin llamadas. |
| README por subproyecto | Se centralizaron las instrucciones: entrada corta en `README.md` y guía física detallada en `docs/pruebas.md`. |

También se quitaron estilos exclusivos del modal retirado, cachés Python y metadatos de Finder. `.gitignore` cubre los temporales y cachés. Las instrucciones describen únicamente la ejecución local que usa el grupo.

## Qué se conserva

- Firmware PIR, diagnóstico USB, recepción de los tres tópicos, filtros CSI, WebSocket, historial, ensayos y comparación.
- Stack existente, dependencias instaladas, entorno virtual y lockfile de npm.
- `.env`, bases SQLite y mediciones. La base `presence.db` de unos 101 MiB no se considera basura por su tamaño.
- Bitácora y los cuatro informes de `output/pdf/`, movidos a `docs/informes/`. Se comprobó que su contenido es idéntico byte por byte.

## Verificación

- Antes: 33 tests de backend y 9 de USB aprobados, usando `DEBUG=false`.
- Después: 31 tests de backend aprobados: se retiraron cuatro del configurador y se agregaron dos para recorrer registro → historial → métricas → comparación y conexión WebSocket → ping/pong → desconexión.
- Los 9 tests de USB siguen aprobados.
- Los 3 tests de arranque local con Mosquitto, FastAPI y Vite pasan y comprueban el cierre de los procesos. Se usaron bases temporales y permisos para abrir los puertos locales.
- TypeScript y build de Vite aprobados. Todos los archivos TypeScript restantes son alcanzables desde la entrada del frontend.
- Sintaxis de `start.sh` y revisión de espacios del diff aprobadas. Los archivos de despliegue opcional se retiraron por no ser parte del uso actual.

El entorno de ejecución tenía `DEBUG=release`, incompatible con el campo booleano existente. Los comandos de prueba usaron `DEBUG=false`; no se cambió la configuración privada. El build sigue avisando que el paquete JavaScript supera 500 kB. TestClient emite advertencias de deprecación de dependencias, sin fallos de tests.

## Observaciones que siguen pendientes

- Faltan los firmware CSI. Las etiquetas de persona/objeto son heurísticas sin validación física; no constituyen resultados del trabajo.
- CSI utiliza y persiste únicamente la primera amplitud de cada mensaje, no el vector completo de subportadoras.
- Si falla una escritura SQLite, la cola de telemetría actual registra el error pero no reencola ese lote. Conviene resolver esa pérdida potencial antes de campañas largas.
- El cálculo actual devuelve F1 nulo cuando precisión o recall valen cero; ese caso requiere revisar la fórmula y sus tests.
- La limpieza no reemplaza la comprobación con placas, sensor y presencia observada. No se verificó hardware físico en esta sesión.

Estas observaciones documentan límites del código existente; no se cambiaron los criterios de detección ni las fórmulas experimentales durante la reorganización.


## Refactor del 24 de octubre de 2026

Se trabajó sobre la limpieza anterior y sus cambios locales, conservando el stack y los datos.

- Separación de `telemetry_state.py`, repositorio SQLite y coordinación de telemetría. Mensaje WebSocket compartido entre conexión inicial y difusión.
- Persistencia y difusión independientes. Las escrituras fallidas conservan el lote; los lotes concurrentes no duplican muestras. El cierre espera las muestras MQTT y las escrituras activas.
- Cálculo de F1 desde los conteos, incluidos resultados iguales a cero. Validación de amplitudes, latencias, scores e históricos.
- Una suscripción React compartida para telemetría. Cancelación de consultas REST y componentes con estados de carga y error.
- Página CSI compartida; formulario de ensayos, tarjetas por método y estado de servicios separados de sus páginas.
- Componentes agrupados por responsabilidad. Ciclo de vida de gráficos y colores centralizados; ECharts carga sólo los módulos utilizados.
- Corrección de etiquetas y colores de los gráficos cuando hay ensayos de un subconjunto de métodos.
- Código de aplicación sin comentarios explicativos redundantes. Las explicaciones de configuración, fórmulas y límites permanecen en la documentación.

Las dos observaciones anteriores sobre pérdida de lotes y F1 quedan resueltas. Siguen pendientes el firmware CSI y la validación física de las heurísticas. No se cambió la selección de la primera amplitud ni los umbrales de detección.

### Verificación del refactor

- 50 tests de backend y 13 tests de frontend aprobados.
- 3 tests de integración aprobados, con puertos locales habilitados y bases temporales. Además del arranque y cierre, comprueban los tres tópicos MQTT, difusión WebSocket y consulta de historial SQLite.
- TypeScript y build de Vite aprobados. JavaScript generado: 735.25 kB, frente a 1284.81 kB al iniciar esta revisión; Vite aún avisa que el paquete supera 500 kB.
- Los 47 módulos TypeScript restantes son alcanzables desde `main.tsx`. No se detectaron imports Python sin uso. Sintaxis de `start.sh` y espacios del diff verificados.
- Persisten dos advertencias de deprecación de las dependencias de TestClient. No se cambiaron versiones para ocultarlas.
- La revisión visual no pudo realizarse porque no estaban concedidos los permisos de control del navegador. No se validó hardware físico.


## Migración del PIR a PlatformIO

Se tomó como base `PRUEBA_PIR` de la rama `bernardo`, commit `24b41a0578bcf6454eb212ca0f74b04cb2523ae6`. Su código leía GPIO27 con `INPUT_PULLDOWN`, imprimía mensajes compatibles con la prueba USB cada 500 ms y no implementaba MQTT. Su configuración fijaba carga y monitor al puerto Windows `COM9`.

La implementación única queda en `firmware/pir/`: `src/main.cpp` conserva la lectura de Bernardo y `src/network.cpp` agrega Wi-Fi/MQTT. Se retiraron el sketch `.ino` y la configuración de ejemplo anteriores de `firmware/pir_mqtt/`. El puerto se detecta automáticamente y las dependencias se declaran en `platformio.ini`. `include/config.h` y los artefactos `.pio/` quedan ignorados por Git.

El framework sigue siendo Arduino, como en la rama original; la compilación y carga se hacen con PlatformIO. El muestreo nominal del ejemplo y de la web pasa a 500 ms. Los informes en `docs/informes/` y las entradas históricas de la bitácora conservan la descripción de la implementación usada en su momento.


Verificación de la migración: compilación PlatformIO para `upesy_wroom` aprobada con Espressif32 6.12.0 y PubSubClient 2.8.0; 50 tests de backend y 13 de frontend aprobados; TypeScript y build web aprobados. El firmware ocupa 44832 bytes de RAM y 748725 bytes de flash según PlatformIO. La compilación usó la configuración de ejemplo y herramientas temporales aisladas; falta completar la red real en `include/config.h` y comprobar la placa físicamente. No se cargó firmware en ningún dispositivo.


La comprobación posterior está en [auditoria-final.md](auditoria-final.md): incluye fallos nuevos reproducidos y corregidos, instalación limpia y pruebas React y de recuperación ampliadas.
