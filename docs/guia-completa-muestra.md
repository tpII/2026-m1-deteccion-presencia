# Guía del sistema de detección de presencia

## Preparación técnica y explicación para la muestra

Taller de Proyecto II · Grupo M1

Edición del 31 de octubre de 2026

Basada en la rama local `francisco`, sobre `6dd6130` con los cambios de arranque y Caso 3 de esta edición.

Esta guía explica cómo poner en marcha el proyecto, preparar los ESP32, interpretar las comunicaciones y presentar los resultados. Está pensada para estudiar desde cero y tenerla abierta durante la muestra. Incluye instrucciones operativas y detalles técnicos del código disponible.

El sistema recibe lecturas de las placas por MQTT, las procesa en Python y las muestra en React mediante WebSocket. Hay tres casos de presentación: PIR, CSI con router y prueba conjunta de esos dos sensores. El Caso 3 conserva estados y gráficos separados; no fusiona decisiones ni necesita otro firmware. El comando de inicio prepara las dependencias y los servicios disponibles para el sistema.

**Qué se verificó para esta guía.** Se leyeron los scripts de arranque, el firmware, el backend, el frontend, los análisis de logs y las pruebas. No se realizó una nueva prueba física ni se midió una latencia real. La existencia de una función en el código se distingue de su validación experimental.

**Cómo leerla.** Primero leé las páginas 2 a 7 para entender el recorrido. Después seguí el procedimiento del caso que vayas a mostrar. Las páginas finales sirven para diagnosticar problemas y preparar la exposición oral.

**Alcance de esta edición.** Se actualizaron el arranque automático, la web y la documentación. La pantalla de diagnóstico USB se retiró. Los informes fechados de avances anteriores permanecen identificados como registros históricos.

<!-- PAGE -->

## 1 Mapa del proyecto y recorrido de lectura

La computadora ejecuta el broker Mosquitto, el backend FastAPI y el servidor de desarrollo del frontend. El ESP32 ejecuta su firmware de forma independiente mientras tenga alimentación. El router permite la comunicación Wi-Fi; en el caso CSI también transmite los paquetes cuyo canal se mide.

```text
PIR o captura CSI
       |
     ESP32 -- Wi-Fi y MQTT --> Mosquitto
                                  |
                               FastAPI
                                  |
                     +------------+------------+
                     |                         |
                 WebSocket                   SQLite
                     |                         |
                 React web <----- REST --------+
```

| Recorrido | Qué existe hoy | Qué demuestra una prueba |
| --- | --- | --- |
| PIR por MQTT | Firmware, recepción y pantalla | Sensor y comunicación completa, si se prueba físicamente |
| Diagnóstico PIR Serial | Monitor de PlatformIO | Lectura local; no valida MQTT |
| CSI por logs | Captura Serial y análisis posterior | Canal grabado y resultado fuera de línea |
| CSI por MQTT | Firmware receptor, detector y pantalla | Integración en vivo, si se prueba con la placa |
| Caso 3 PIR + CSI | Las dos fuentes anteriores en una pantalla | Comparación simultánea; no es otra detección |

**Dónde buscar cada explicación.** Arranque: páginas 3 y 4. Red y protocolos: 5 y 6. Configuración: 7. PIR: 8 y 9. CSI: 10 a 15. Caso conjunto: 16. Tiempos y almacenamiento: 17. Ensayos: 18. Cambio de red: 19. Diagnóstico: 20. Exposición: 21 y 22. Fuentes: 23. Organización del repositorio y vocabulario: 24.

**Tres comprobaciones diferentes.** “LIVE” significa que el navegador está conectado al backend. `mqtt_connected: true` significa que el backend se conectó al broker. Un contador `total_samples` que aumenta significa que el backend está procesando mensajes de ese caso. Ninguna de las primeras dos comprobaciones, por sí sola, prueba la presencia de un ESP32 real.

<!-- PAGE -->

## 2 Qué ocurre al ejecutar start sh

En macOS o Linux, desde la raíz del repositorio:

```bash
./start.sh
```

Ese comando prepara lo necesario y levanta todo el servidor. También se puede usar `bash start.sh` si el archivo no tiene permiso de ejecución. La primera vez necesita Internet y puede pedir permisos de administrador. Las placas se cargan por separado.

1. El script carga `scripts/setup.sh`, busca Python 3.12+ y Node 20.19+ con npm. En macOS instala herramientas faltantes con Homebrew y puede instalar Homebrew mediante su instalador oficial. En Linux con apt usa los paquetes del sistema; para Node faltante descarga el binario oficial de la rama 24 y comprueba su SHA256.
2. Comprueba que 8000 y 5173 estén libres; no cierra otra instancia para ocupar sus puertos.
3. Crea `.env` desde el ejemplo solo si falta. Crea `backend/.venv` y prepara las dependencias Python y Node. Conserva un entorno incompatible como respaldo antes de crear otro.
4. Compara firmas de requisitos y componentes esenciales. Si las dependencias no cambiaron y siguen disponibles, las reutiliza. Si corresponde reinstalar, usa pip y `npm ci` con el lockfile.
5. Lee el host y puerto MQTT reales del backend. Reutiliza un broker que responda o instala e inicia Mosquitto si se necesita un broker local. Para un puerto local distinto genera configuración en `.runtime/`; un broker remoto debe estar disponible en su equipo.
6. Inicia Uvicorn en `127.0.0.1:8000`, espera salud y conexión MQTT, inicia Vite en `127.0.0.1:5173` y espera respuesta HTTP. Abre la web mediante el navegador disponible.

Al iniciar FastAPI se crean tablas faltantes y se preparan las tareas de difusión WebSocket y guardado periódico. No hace falta instalar SQLite como servidor separado ni arrancar cada programa manualmente.

**Direcciones.** Web: `http://localhost:5173`. API: `http://localhost:8000/docs`. Caso conjunto: `http://localhost:5173/case/combined`.

**Límites del equipo.** Homebrew puede exigir herramientas de Apple. La instalación con apt requiere Python 3.12+ disponible en la distribución, como Ubuntu 24.04+ o Debian 13+. Ante un fallo, el script muestra el paso y se repite el mismo comando después de resolverlo. Un broker reutilizado puede necesitar configurar su escucha LAN o el firewall para las placas.

**Apagado.** `Ctrl+C` detiene los procesos iniciados por el script. Conserva programas instalados, SQLite y un broker previamente activo. No detiene el firmware de una placa alimentada.

<!-- PAGE -->

## 3 Qué ocurre al ejecutar start bat

En Windows, desde la raíz del repositorio:

```text
.\start.bat
```

El BAT llama a `start.ps1` con PowerShell. Su opción de ejecución se aplica a esa invocación; no cambia permanentemente la política de scripts. Puede usarse también doble clic en el BAT.

1. Comprueba puertos 8000 y 5173 para evitar iniciar otra instancia encima.
2. Busca Python 3.12+ y Node 20.19+ con npm. Si faltan, usa WinGet para instalar Python 3.12 y Node LTS. Actualiza el PATH del proceso para intentar utilizarlos sin abrir otra terminal.
3. Crea `.env` desde `.env.example` solo si no existe. Conserva credenciales y configuración anteriores.
4. Crea el entorno virtual en `backend\.venv`. Si es incompatible, lo respalda antes de crear otro. Instala requisitos Python con pip y el frontend con `npm ci`; registra las firmas para reutilizarlos en los próximos arranques.
5. Lee el broker configurado. Si responde, lo reutiliza. Si se necesita uno local e inexistente, intenta instalar Mosquitto con WinGet e iniciarlo. No instala un broker en una computadora remota.
6. Inicia el backend, espera salud y conexión MQTT, inicia el frontend y comprueba su respuesta. Abre `http://localhost:5173` y muestra las IPv4 de la computadora para ayudar a configurar el firmware.

**Primera ejecución.** Se necesita Internet. Windows puede pedir autorización de instalación, elevación, firewall o reinicio. Si falta WinGet, el mensaje dirige a App Installer de Microsoft; después se repite el mismo BAT. No se promete eludir permisos o políticas del equipo.

**Las siguientes veces.** Si los archivos de dependencias y los componentes comprobados no cambiaron, se reutilizan. Las bibliotecas, configuración y bases permanecen al cerrar el programa.

**Broker y firewall.** Un broker existente que responda localmente no garantiza acceso desde el ESP32. Comprobar que acepte la LAN y el puerto MQTT de la red del ensayo. El script conserva servicios ajenos en lugar de detenerlos sin saber su uso.

**Apagado.** `Ctrl+C` intenta detener los procesos que inició y sus hijos. Si un fallo deja una instancia abierta, cerrarla antes de repetir. El firmware se prepara aparte con PlatformIO y no se borra al detener Windows o el BAT.

<!-- PAGE -->

## 4 Red física y significado de canal

En este proyecto aparecen varios conceptos con la palabra “canal”. Conviene distinguirlos antes de explicar las comunicaciones.

| Concepto | Qué identifica | Ejemplo del proyecto |
| --- | --- | --- |
| Canal de radio Wi-Fi | Recurso de frecuencia compartido | Canal informado por el ESP32 al conectarse |
| Subportadora OFDM | Componente del paquete sobre la que se estima el canal | Amplitudes del bloque HT-LTF |
| Dirección IP | Equipo de la red | IP LAN de la computadora con Mosquitto |
| Puerto TCP | Servicio dentro del equipo | 1883 para MQTT; 8000 para FastAPI |
| Tópico MQTT | Nombre lógico para distribuir mensajes | `presence/csi/router/raw` |
| Ruta HTTP | Operación de la API o pantalla web | `/api/v1/health` o `/case/pir` |

Los tópicos MQTT no son frecuencias de radio. Cambiar de tópico no separa físicamente dos transmisiones Wi-Fi. Del mismo modo, el puerto 1883 no representa una versión del estándar inalámbrico.

**Topología habitual.** ESP32 y computadora se conectan a la misma red local. La computadora puede usar Wi-Fi o Ethernet si ambos permiten comunicación entre sus equipos. La red no debe aislar a sus clientes. No hace falta Internet para el intercambio local una vez instaladas las dependencias.

**Dos funciones del router.** Para PIR, el router transporta mensajes. Para CSI con router, también es el origen de los paquetes de radio que recibe el ESP32 para medir el canal. Mosquitto es un programa de la computadora; no es el router.

**Compatibilidad Wi-Fi.** Las placas ESP32 clásicas del proyecto trabajan en 2,4 GHz. Conectarse a una red b/g/n no prueba que los paquetes tengan el formato HT-LTF que utiliza el análisis actual. El procesamiento de CSI del repositorio interpreta un bloque correspondiente al caso HT de 20 MHz; hay que comprobar el formato real de los paquetes en cada router. El firmware no fuerza explícitamente todas esas condiciones.

La documentación de Espressif describe que los campos CSI presentes y su longitud dependen del formato del paquete. Por eso, “conecta al Wi-Fi” y “produce CSI utilizable por este detector” son verificaciones distintas.

<!-- PAGE -->

## 5 Comunicaciones desde la placa hasta el navegador

**Wi-Fi e IP.** La placa usa Wi-Fi para entrar a la red y alcanzar la IP del broker. El firmware usa `WiFiClient` y PubSubClient para publicar por MQTT sobre una conexión TCP. El backend usa paho-mqtt. En esta configuración se emplea el puerto 1883, sin TLS ni credenciales MQTT.

**MQTT.** Es un protocolo de publicación y suscripción. El ESP32 publica un mensaje en un tópico, Mosquitto lo distribuye y el backend recibe los tópicos a los que está suscrito. MQTT permite comunicación en ambos sentidos, pero este firmware no implementa recepción de comandos de calibración.

| Caso | Tópico | Contenido principal |
| --- | --- | --- |
| PIR | `presence/pir/telemetry` | `case_id`, `presence`, `raw_value` |
| CSI router | `presence/csi/router/raw` | `case_id`, `amplitudes` |
| Dedicado histórico | `presence/csi/dedicated/raw` | Contrato conservado; no forma parte de la muestra actual |

Ejemplos ilustrativos del contrato, sin representar una medición:

```json
{"case_id":"pir","presence":true,"raw_value":1}
{"case_id":"csi_router","amplitudes":[22.4,23.1,21.8]}
```

El esquema acepta un vector no vacío; el firmware CSI disponible envía 55 valores. El backend comprueba JSON, números finitos y correspondencia entre tópico y `case_id`. Un mensaje inválido se rechaza y se registra en consola.

**WebSocket.** El navegador abre `ws://localhost:8000/ws/telemetry`. Recibe un estado inicial y luego lotes del estado actual cada unos 120 ms. No abre una conexión MQTT al broker. La recarga de la web no programa ni reinicia el ESP32.

**HTTP y REST.** Se usan para consultar historial y métricas, guardar ensayos y pedir calibración. REST funciona por petición y respuesta; WebSocket mantiene el intercambio para la visualización en vivo.

**Entrega.** La suscripción del backend es QoS 0; las publicaciones del firmware no son retenidas. No hay confirmación de persistencia extremo a extremo ni recuperación de muestras tomadas durante una desconexión. El broker tiene su persistencia desactivada; SQLite es el almacenamiento de la aplicación.

<!-- PAGE -->

## 6 Configuración de cada componente

El arranque crea `.env` si falta, sin sobrescribir archivos existentes. Hay configuraciones diferentes para computadora, navegador y placas. Un cambio en `.env` no modifica automáticamente el programa grabado en el ESP32.

| Componente | Archivo | Qué se configura |
| --- | --- | --- |
| Backend | `.env` de la raíz | Host y puerto MQTT, SQLite, CORS y registros |
| Backend compatible | `backend/.env`, si existe | Tiene prioridad sobre `.env` de la raíz |
| Frontend | `frontend/.env.local` | `VITE_API_URL` y `VITE_WS_URL` |
| Mosquitto | `mosquitto/mosquitto.conf` | Interfaz de escucha, puerto y acceso |
| PIR | `firmware/pir/include/config.h` | Red, broker, pin e intervalo |
| CSI en vivo | `firmware/csi_router/include/config.h` | Red, broker y ping |
| Captura Serial CSI | `prueba_CSI/include/wifi_secrets.h` | `WIFI_SSID` y `WIFI_PASS` |

**Ejemplo de IP.** Supongamos que la computadora recibe `192.168.1.50`. En el ESP32, `MQTT_HOST` debe ser `192.168.1.50`. En el backend puede seguir siendo `localhost`, porque Mosquitto corre en la misma computadora. `localhost` siempre designa al equipo que lo interpreta: en el ESP32 designaría a la propia placa.

**Prioridad del backend.** Las variables del proceso tienen prioridad sobre ambos archivos `.env`. Reiniciá el backend después de cambiar su configuración. Los cambios del frontend requieren reiniciar Vite. Los cambios en los archivos de la placa requieren compilar y volver a cargar el firmware.

**Cómo conocer la IP.** En Windows, ejecutá `ipconfig` y buscá la IPv4 del adaptador conectado. En macOS, consultá Wi-Fi → Detalles → TCP/IP. En Linux, `hostname -I`. Si hay VPN, máquinas virtuales o varias interfaces, elegí la dirección alcanzable desde la red del ESP32, no cualquiera de la lista.

Los archivos locales de configuración de las placas se crean copiando sus ejemplos. Completá tus datos y no muestres las contraseñas durante la exposición. Los ejemplos se usan como estructura; revisá sus valores antes de cargar la placa.

**Placa programada.** El USB sirve para cargar, alimentar o diagnosticar. El firmware queda guardado después de desconectar y volver a conectar. Solo hace falta flashear de nuevo si cambian el programa o sus valores compilados.

<!-- PAGE -->

## 7 Preparar y cargar el caso PIR

El Caso 1 utiliza un PIR con salida digital conectado al ESP32. El código lee GPIO27 con resistencia interna de pull-down y publica su nivel. El procesamiento CSI no participa en este caso.

**Preparación física.** La guía del repositorio describe un HW-416-B con OUT a GPIO27 y masa común. Para ese montaje indica VCC a VIN/5V. Antes de repetirlo, verificá las etiquetas y la alimentación del módulo físico y que su salida sea compatible con la entrada del ESP32. El repositorio no aporta una ficha técnica del sensor que permita generalizar el cableado a cualquier PIR. Desconectá la alimentación antes de cambiar cables.

**Programas necesarios.** VS Code con PlatformIO IDE, o PlatformIO Core. PlatformIO compila el firmware y lo carga; no se necesita ejecutar el backend para flashear. El entorno definido es `upesy_wroom`; debe corresponder a la placa utilizada.

1. Abrí `firmware/pir/` como proyecto PlatformIO.
2. Abrí `include/config.h`, incluido con valores genéricos.
3. Completá `WIFI_SSID`, `WIFI_PASSWORD` y la IP LAN del broker en `MQTT_HOST`. Conservá el tópico del PIR y el puerto del broker.
4. Conectá la placa con un cable USB de datos. Cerrá otros monitores que ocupen su puerto.
5. Ejecutá Build y luego Upload. Esperá la confirmación de carga y reinicio.

Comandos equivalentes desde la raíz del repositorio:

```bash
pio run --project-dir firmware/pir
pio device list
pio run --project-dir firmware/pir --target upload
pio device monitor --project-dir firmware/pir --baud 115200
```

Si hay varias placas, agregá `--upload-port PUERTO` a la carga o `--port PUERTO` al monitor, reemplazando PUERTO por el dispositivo real. No asumas un COM fijo.

**Resultado esperado.** La consola puede mostrar `MOVIMIENTO` o `SIN MOVIMIENTO`, y confirma MQTT cuando logra conectarse. Ver texto Serial demuestra lectura local; para demostrar recepción por red seguí la página siguiente. No hay un botón de calibración web para PIR.

<!-- PAGE -->

## 8 Probar el PIR y diagnosticarlo por Serial

**Prueba completa por MQTT.** Iniciá `./start.sh` o `.\start.bat`, encendé la placa programada y abrí `http://localhost:5173/case/pir`. Los datos llegan por MQTT y WebSocket; no hay un botón de conexión USB.

Movete frente al sensor, observá el gráfico digital y dejá luego el ambiente sin movimiento. Esperá la estabilización que corresponda al módulo físico. No confundas el tiempo durante el cual el PIR mantiene su salida alta con la demora de comunicación.

Comprobá en `/api/v1/telemetry/status` que el caso `pir` tenga muestras nuevas. Para mirar mensajes del broker, con sus herramientas disponibles:

```bash
mosquitto_sub -h localhost -p 1883 -t presence/pir/telemetry -v
```

El GPIO se lee cada **500 ms nominales**. Si la salida cambia entre dos lecturas, la espera de muestreo puede ser aproximadamente de 0 a 500 ms con el bucle funcionando normalmente. Las reconexiones pueden demorar el bucle. Eso no mide el tiempo desde el movimiento físico hasta la activación del sensor o la pantalla.

**Diagnóstico Serial.** La pantalla Prueba PIR USB fue eliminada. Para revisar la lectura local, usar el monitor de PlatformIO a 115200 baud:

```bash
pio device monitor --project-dir firmware/pir --baud 115200
```

El firmware imprime `MOVIMIENTO` y `SIN MOVIMIENTO` y puede publicar MQTT al mismo tiempo. Ver esos mensajes no demuestra llegada al broker: verificá MQTT, contador y gráfico. Para cargar otra vez el firmware, cerrar primero el monitor que ocupa el puerto.

**Prueba conjunta.** En `/case/combined` se observa esta misma fuente junto con CSI con router. El Caso 3 no cambia el programa del PIR ni genera una decisión combinada. El estado PIR se expresa como movimiento o sin movimiento.

**Qué decir en la muestra.** “El sensor informa movimiento mediante una salida digital. La placa la lee y transmite ese estado; una salida cero no demuestra que no haya una persona quieta”. El programa no determina si quien se mueve es una persona o un objeto.

**Latencia real.** Definí qué medís: movimiento a salida del PIR, salida a lectura del ESP32 o movimiento a visualización. El firmware no calcula esa latencia; el campo omitido queda en cero por defecto. No lo presentes como una medición.

<!-- PAGE -->

## 9 Qué mide CSI y cómo se obtiene

CSI significa Channel State Information, información del estado del canal. El receptor Wi-Fi obtiene estimaciones del canal a partir de campos conocidos del paquete. El proyecto conserva valores complejos por subportadora y calcula amplitudes. El RSSI, en cambio, resume la potencia recibida en un solo valor.

En el código, cada par está ordenado como parte imaginaria y parte real. La amplitud se calcula como:

```text
H(k,t) = real(k,t) + j * imag(k,t)
A(k,t) = sqrt(real(k,t)^2 + imag(k,t)^2)
```

`k` identifica la subportadora y `t` el paquete recibido. Estos valores no son una imagen de la habitación ni coordenadas de una persona. Son características del enlace de radio. El objetivo experimental es relacionar sus cambios con presencia y movimiento, manteniendo controladas las condiciones.

**Por qué cambia con el ambiente.** La señal puede llegar al receptor por el camino directo y por reflexiones en paredes, muebles y cuerpos. Esos recorridos se combinan y cambian la amplitud y fase recibidas. Una persona puede alterar esa combinación; también pueden hacerlo otros cambios del montaje. La detección usa esos cambios como indicios y necesita una referencia y evaluación experimental para interpretarlos.

**Generación de tráfico.** El ESP32 manda ping ICMP al gateway cada 100 ms para provocar respuestas regulares. El driver obtiene CSI de los paquetes que recibe y el programa filtra por MAC del router. Ping genera tráfico; no contiene una orden “medir presencia”. Tampoco exige acceso a Internet.

**Límite del filtro.** Se filtra por origen MAC, no por una comprobación de que cada paquete sea una respuesta ICMP. El tráfico originado en el router y otros cambios de la red deben considerarse al interpretar las muestras. No está demostrado que se capture exclusivamente un paquete por ping.

**Bloque utilizado.** El firmware CSI de MQTT y el analizador de logs usan por defecto el bloque HT-LTF a partir del byte 128 y seleccionan `k = -28 … 28`, excluyendo 0 y 1: quedan 55 amplitudes. Es una interpretación específica del formato esperado de 20 MHz. Los paquetes sin longitud suficiente se descartan; esa comprobación de longitud no valida todas las variantes posibles de radio.

**Compatibilidad.** Para esta prueba no alcanza con decir “cualquier router viejo”. Un enlace que solo aporte tramas legacy puede no producir el HT-LTF esperado. Revisá formato, ancho de canal y cantidad de paquetes útiles. La capacidad de asociarse a la red y la capacidad de alimentar este análisis son condiciones distintas.

<!-- PAGE -->

## 10 Capturar CSI por Serial y guardar logs

Usá este recorrido cuando quieras investigar los paquetes o generar gráficos después de la prueba:

```text
Router -- paquetes Wi-Fi --> ESP32 con prueba_CSI
                                  |
                             USB y Serial
                                  |
                         Monitor y archivo log
```

Esta captura funciona sin arrancar la web, el backend o Mosquitto. Programarla en una placa reemplaza el firmware que esa misma placa tenía antes; una placa no ejecuta simultáneamente los dos proyectos.

1. Abrí `prueba_CSI/` en PlatformIO. Copiá `include/wifi_secrets.example.h` como `include/wifi_secrets.h`.
2. Completá `WIFI_SSID` y `WIFI_PASS` con la red del router o punto de acceso que vayas a probar.
3. Compilá, cargá y abrí el monitor. La velocidad aquí es **921600 baud**, diferente de PIR y del firmware CSI MQTT.

```bash
pio run --project-dir prueba_CSI
pio run --project-dir prueba_CSI --target upload
pio device monitor --project-dir prueba_CSI
```

Los filtros `time` y `log2file` agregan la hora de la computadora y guardan la salida. Mirá la ruta del archivo que informa el monitor; verificá dónde se creó en tu ejecución y conservá esa ruta junto con las notas del ensayo.

| Tecla sin Enter | Acción |
| --- | --- |
| `h` | Mostrar ayuda |
| `s` | Mostrar estadísticas |
| `d` | Explicar el próximo paquete |
| `n` | Imprimir una muestra CSV |
| `c` | Activar o desactivar CSV continuo |

**Punto clave.** El CSV continuo empieza desactivado. Pulsá `c` para empezar un tramo y otra vez para cerrarlo. El analizador reconoce esos marcadores; las líneas sueltas obtenidas con `n` no sustituyen un tramo registrado de esa manera.

Registrá períodos de ambiente vacío, persona caminando y persona sentada quieta. Anotá el orden, tiempos, ubicación, canal y cambios de escenario. La captura no conoce por sí sola cuál es la situación real. Los contadores de cola llena indican pérdidas; no presentes una frecuencia nominal de 10 Hz como una garantía de captura.

<!-- PAGE -->

## 11 Analizar logs y reproducirlos por MQTT

Los gráficos obtenidos con `prueba_CSI/analisis/analizar_csi.py` son resultados fuera de línea: primero se graba y después se procesa. El script genera `indicadores.png`, `amplitud_subportadoras.png` y `resumen.txt`.

**Entorno de análisis.** Usá un Python con `numpy`, `pandas` y `matplotlib`. Estos dos últimos no están en `backend/requirements.txt`; arrancar la aplicación no garantiza que esté listo el análisis. El intérprete suele llamarse `python3` en macOS/Linux y `python` o `py` en Windows.

Ejemplos desde la raíz; reemplazá `RUTA_LOG` por el archivo real y entrecomillá rutas con espacios:

```bash
python3 -m pip install numpy pandas matplotlib
python3 prueba_CSI/analisis/analizar_csi.py "RUTA_LOG"
```

El primer comando de análisis lista tramos. Se numeran desde **0**. Si el tramo 0 es vacío, el 1 caminando y el 2 sentado:

```bash
python3 prueba_CSI/analisis/analizar_csi.py "RUTA_LOG" \
  --vacio 0 --caminando 1 --sentado 2 \
  --calibracion 10:40 --salida "output/analisis-muestra"
```

Las barras de continuación corresponden a Bash; en Windows escribí la orden en una sola línea. Los números son un ejemplo y deben coincidir con tu registro. Elegí un tramo vacío suficientemente largo y reservá una parte distinta para medir falsas alarmas. No evalúes únicamente sobre los mismos datos usados para calibrar.

**Reproducción hacia la web.** El script existente puede publicar un log por MQTT, respetando sus tiempos relativos. Iniciá el sistema y ejecutá con un Python que tenga `numpy` y `paho-mqtt`:

```bash
python3 prueba_CSI/analisis/reproducir_log_mqtt.py "RUTA_LOG" \
  --host localhost --tramo 0
```

Sin `--tramo`, elige el tramo con más paquetes. Para calibrar el backend reproducí un tramo vacío con tiempo suficiente para los 10 s de espera y 30 s de registro. Luego podés reproducir los otros escenarios. Cerrá cualquier publicador físico del mismo caso para no mezclar las fuentes.

**Cómo presentarlo.** “Esta es una reproducción de una captura, que permite comprobar el procesamiento y la visualización”. La web puede marcar el caso conectado y habilitar calibración con datos reproducidos; eso no convierte la reproducción en una nueva medición en vivo.

<!-- PAGE -->

## 12 CSI con router y publicación en vivo

Para probar el sistema completo usá **`firmware/csi_router/`**, no `prueba_CSI/`. El recorrido es:

```text
ESP32 -- ping --> Router
ESP32 <-- paquetes del router y obtención de CSI
ESP32 -- amplitudes por MQTT --> Mosquitto
                                  |
                           Backend detector
                                  |
                           WebSocket y web
```

1. Conectá la computadora a la red del ensayo y obtené su IP LAN.
2. Editá `firmware/csi_router/include/config.h`. Completá `WIFI_SSID`, `WIFI_PASSWORD` y `MQTT_HOST`. Verificá puerto 1883 y tópico `presence/csi/router/raw` si usás la configuración habitual.
3. Iniciá `start.sh` o `start.bat` y comprobá salud del backend.
4. Abrí el proyecto en PlatformIO, compilá y cargá en la placa correspondiente. El entorno definido es `esp32doit-devkit-v1`.

```bash
pio run --project-dir firmware/csi_router
pio run --project-dir firmware/csi_router --target upload
pio device monitor --project-dir firmware/csi_router --baud 115200
```

5. Revisá IP, canal, conexión MQTT y estadísticas. Cada unos 10 segundos aparecen contadores de CSI recibido, publicado, fallas MQTT, cola llena y paquetes sin bloque de longitud suficiente.
6. Abrí `/case/csi_router`. Verificá que aumente `total_samples` y luego calibrá como indica la página siguiente.

**Qué publica la placa.** Calcula 55 amplitudes y las envía en JSON. La decisión de presencia se calcula en Python, no en el ESP32. El callback Wi-Fi copia datos a una cola de 16 entradas; el bucle principal convierte y publica. Si no puede consumir a tiempo, puede perder paquetes.

**Después del flasheo.** La conexión, captura y publicación empiezan automáticamente si la red y el broker están disponibles. La primera calibración no arranca sola. Apagar la placa no borra su firmware; reiniciar el backend sí borra su referencia de calibración en memoria.

**Prueba de red.** Podés observar el tópico con `mosquitto_sub -h localhost -p 1883 -t presence/csi/router/raw -v`. Que haya JSON no prueba aún que los datos correspondan al formato de radio esperado ni que la detección sea exacta: verificá ambas cosas con ensayos.

<!-- PAGE -->

## 13 Calibrar desde la web

La calibración aprende cómo es el canal con la habitación vacía. Debe hacerse con router, ESP32 y mobiliario en las posiciones que se usarán en la prueba.

1. Esperá que lleguen muestras a `/case/csi_router`. El botón se habilita cuando el caso está conectado y no hay otra calibración en curso.
2. Pulsá **Calibrar**. La web envía HTTP POST a `/api/v1/csi/csi_router/calibration`.
3. Durante **10 segundos** el estado es `esperando`. Salí del área de ensayo antes de que termine.
4. Durante **30 segundos** el estado es `calibrando`. Se registran muestras de la habitación vacía.
5. El backend calcula referencia y umbrales. Si tiene datos suficientes, pasa a `calibrado`. El mínimo implementado es de 50 paquetes; la tasa nominal permitiría obtener más, pero no se presupone su entrega.
6. Volvé a entrar y comprobá por separado ambiente vacío, movimiento y persona quieta. Mirá los dos indicadores y sus umbrales, además del estado binario.

**Quién hace cada cosa.** El ESP32 sigue capturando y publicando. El navegador solo solicita el comienzo y muestra el estado. El backend reúne muestras y realiza los cálculos. No se envía una instrucción MQTT de calibración a la placa.

**Si falla.** Leé el mensaje completo. Sin suficientes paquetes, la primera calibración queda sin completar. Una recalibración fallida puede conservar la referencia anterior y volver a mostrar estado calibrado con un mensaje de fallo; no basta mirar únicamente la etiqueta.

**Antes de calibrar.** El indicador de movimiento puede mostrar valores, pero el detector inicial no emite presencia positiva; todavía no tiene referencia ni umbrales válidos. Un resultado de ausencia en ese estado no constituye una medición de ambiente vacío.

**Cuándo repetirla.** Después de reiniciar el backend o modificar router, posición de equipos, mobiliario o condiciones del enlace. El código también invalida la referencia si cambia la cantidad de subportadoras recibidas después de calibrar. No se guarda la calibración en SQLite.

**Limitación operativa.** La implementación no reinicializa todo el historial de movimiento al empezar una recalibración; la prueba debe observar el mensaje y dejar estabilizar la ventana. Mantener un procedimiento constante ayuda a comparar ensayos, pero no sustituye validar el detector.

<!-- PAGE -->

## 14 Cómo calcula presencia el detector CSI

El detector utiliza todas las amplitudes del paquete. El pipeline antiguo de Hampel, media móvil y varianza fue reemplazado en esta rama por `CsiPresenceDetector`. Las referencias históricas a ese pipeline no describen el algoritmo actual.

**Normalización.** Para cada paquete calcula su amplitud media y divide las amplitudes por esa media. Esto reduce la dependencia de una escala común del paquete; no elimina cualquier ruido, interferencia o cambio de ganancia de forma garantizada.

**Movimiento.** Calcula la turbulencia como desvío entre subportadoras dividido por su media. Después toma el desvío temporal de esa turbulencia sobre una ventana de 4 segundos.

**Forma.** Compara el perfil normalizado actual con el perfil promedio obtenido durante la calibración. La distancia RMS, raíz del promedio de las diferencias al cuadrado, se promedia en una ventana de 4 segundos. Intenta detectar cambios persistentes del enlace, incluso si el indicador de movimiento queda bajo. El desvío estándar mide dispersión respecto de una media; aquí se usa entre subportadoras o entre valores temporales según la etapa.

```text
perfil(k,t) = A(k,t) / media_k(A(k,t))
turbulencia(t) = desvio_k(A(k,t)) / media_k(A(k,t))
movimiento(t) = desvio_ventana(turbulencia)
distancia(t) = RMS_k(perfil(k,t) - referencia(k))
forma(t) = media_ventana(distancia)
umbral = max(media_base + 3 * desvio_base, 1.3 * media_base)
```

Hay un umbral independiente por indicador. La ventana necesita al menos 5 muestras para producir su estadístico; no exige siempre 4 segundos completos al arrancar. La presencia se activa, una vez calibrado, cuando la relación más alta entre indicador y umbral es mayor o igual a 1. Con valores extremos o umbrales cero, las condiciones del código también importan; las fórmulas describen el caso normal.

**Qué muestran los gráficos.** Movimiento y forma se comparan con sus líneas de umbral. La “señal cruda” de la web es la amplitud media por paquete, no las 55 curvas individuales. El mapa de calor del análisis fuera de línea sí permite ver subportadoras por separado.

**Qué significa el score.** `detection_ratio` es una relación con el umbral, puede superar 1 y no es una probabilidad. No significa “certeza de que hay una persona”. La etiqueta interna `person_active` se asigna por la decisión binaria; no prueba clasificación de identidad, respiración ni distinción de persona quieta frente a otros cambios del ambiente.

<!-- PAGE -->

## 15 Caso 3 de PIR y CSI en conjunto

El Caso 3 es la prueba simultánea de los montajes de los casos 1 y 2. Permite comparar qué indica PIR y qué estima CSI frente al mismo escenario. Conserva estados y gráficos separados; no calcula una decisión fusionada.

```text
PIR y ESP32 ---- MQTT ----+
                         |
CSI router y ESP32 ------+--> Mosquitto --> Backend
                                             |
                                      WebSocket compartido
                                             |
                                       Caso 3 PIR + CSI
```

1. Prepará una placa con `firmware/pir/` y otra con `firmware/csi_router/`. Completá red e IP del broker y cargá cada programa con PlatformIO.
2. Ejecutá `./start.sh` o `.\start.bat`. El comando prepara dependencias y servicios. Encendé las placas y abrí `/case/combined`.
3. Verificá **2 de 2 sensores con lecturas** y los contadores individuales. Si falta una fuente, la otra sigue visible; no se inventa su resultado.
4. Calibrá CSI desde esa pantalla. Es el mismo detector `csi_router` del Caso 2: la referencia se comparte entre las dos vistas.
5. Compará vacío, caminando y sentado quieto. PIR muestra movimiento o sin movimiento. CSI indica si está sin calibrar, calibrando o con una estimación válida de presencia.
6. Registrá por separado los resultados de PIR y CSI en Sistema & Hardware. La comparación cuantitativa usa esos dos métodos, sin crear métricas artificiales de un tercer sensor.

**No se necesita un tercer firmware.** Se reutilizan `presence/pir/telemetry` y `presence/csi/router/raw`. Tampoco hace falta volver a flashear las placas para pasar de las vistas individuales a la conjunta.

**Tiempos diferentes.** PIR se lee cada 500 ms nominales y CSI usa ventanas de 4 segundos. Compartir pantalla no sincroniza físicamente la adquisición. Las respuestas pueden cambiar en instantes distintos.

**Compatibilidad histórica.** El antiguo enlace dedicado entre dos ESP32 dejó de ser el Caso 3 de la web. Su identificador, tópico y datos permanecen en el backend por compatibilidad. La dirección antigua redirige a la vista conjunta, pero los datos históricos no se convierten ni se mezclan con PIR + CSI.

<!-- PAGE -->

## 16 Frecuencias latencias y almacenamiento

| Tiempo o tamaño | Valor implementado | Qué representa |
| --- | --- | --- |
| Lectura PIR | 500 ms nominales | Muestreo del GPIO; unos 2 Hz |
| Ping CSI | 100 ms nominales | Generación de tráfico; unos 10 Hz |
| Ventana detector CSI | 4 s | Historia temporal usada por los indicadores |
| Difusión WebSocket | Unos 120 ms | Envío del estado a la web; unos 8,3 Hz |
| Guardado periódico | Unos 2 s | Escritura por lotes en SQLite |
| Desconexión por caso | 10 s sin actualizar | Criterio de muestras recientes |
| Buffers por serie | Hasta 500 puntos | Memoria temporal del backend |
| Datos enviados | 100 crudos y hasta 300 por indicador | Recorte para la visualización |

Son relojes distintos. Ocho actualizaciones de pantalla por segundo no significan ocho muestras nuevas del PIR. Puede difundirse varias veces el mismo último valor. Una ventana de 4 segundos no significa que el cálculo tarde 4 segundos de CPU ni que la decisión cambie siempre exactamente 4 segundos después del evento.

**Latencia total.** Incluye respuesta física, espera de muestreo, red, colas, procesamiento y espera de actualización de pantalla. El código no mide automáticamente esa suma. La hora del gráfico se asigna al procesar la muestra en el backend; no es una hora sincronizada de adquisición en la placa. Los timestamps de radio de los logs son microsegundos locales del ESP32.

**SQLite.** `telemetry` guarda automáticamente un valor por mensaje, presencia, hora, latencia y score. Para CSI conserva la amplitud media, no el vector completo. `trials` guarda ensayos etiquetados manualmente. `pir_usb_readings` conserva el historial del diagnóstico USB retirado; la web actual no ofrece ese guardado.

**Ruta de la base.** Por defecto es `sqlite+aiosqlite:///./presence-hardware.db`; los scripts arrancan desde `backend`, por lo que normalmente queda allí. Una ruta relativa depende del directorio de ejecución.

**Al reiniciar.** Se pierden buffers, contadores de sesión y calibración; las filas guardadas permanecen. Un cierre normal vacía la cola pendiente. Un cierre abrupto puede perder datos aún en memoria. Consultar el historial también fuerza un guardado pendiente. La persistencia no es necesaria para que avance el gráfico.

<!-- PAGE -->

## 17 Registrar ensayos y comparar métodos

Una gráfica que se mueve prueba que hay valores en el recorrido, pero la exactitud requiere comparar la decisión con una observación independiente de la realidad, llamada ground truth.

En **Sistema y Hardware**, el formulario permite elegir método, presencia observada, detección, latencia y notas. Ambos estados se ingresan manualmente: el formulario no copia automáticamente la última decisión de la telemetría. Comprobá que lo que registrás corresponde al mismo instante o intervalo que observaste.

| Realidad observada | Detector | Resultado |
| --- | --- | --- |
| Persona presente | Presencia | Verdadero positivo o TP |
| Habitación vacía | Ausencia | Verdadero negativo o TN |
| Habitación vacía | Presencia | Falso positivo o FP |
| Persona presente | Ausencia | Falso negativo o FN |

```text
Exactitud = (TP + TN) / total
Precision = TP / (TP + FP)
Recall = TP / (TP + FN)
F1 = 2 * TP / (2 * TP + FP + FN)
```

La API llama `detection_rate` a la exactitud y la expresa como porcentaje. Precisión, recall y F1 usan escala de 0 a 1 y pueden ser nulos si no hay denominador. No confundas estas métricas de ensayos con el porcentaje de paquetes que superó un umbral en el análisis de un log.

**Procedimiento sugerido.** Fijá posiciones y duración por situación; probá vacío, caminando y sentado quieto; separá calibración de evaluación; repetí en condiciones registradas. Para comparar métodos, mantené la misma definición de ensayo y de latencia. Anotá cambios de canal, tráfico o mobiliario.

**Limitación del formulario.** Exige una latencia numérica no negativa. Si no fue medida, no inventes un valor ni ingreses cero para aparentar una medición: ese cero entraría en el promedio. El flujo actual no permite omitirla en un ensayo. Podés explicar la detección cualitativamente y conservar notas externas hasta disponer de una medición válida.

**Score de ensayo.** La API de ensayos acepta un score opcional entre 0 y 1. El ratio CSI puede exceder 1: no son campos intercambiables directamente. La comparación no se llena solo por recibir MQTT; necesita los ensayos de `trials`.

<!-- PAGE -->

## 18 Cambiar de router o usar un celular

**Captura Serial con `prueba_CSI/`.** Cambiá `WIFI_SSID` y `WIFI_PASS` en `include/wifi_secrets.h`, recompilá y cargá de nuevo. No usa `.env`, Mosquitto ni el backend. Obtiene automáticamente la MAC y gateway de la red a la que se conecta. Guardá nuevos tramos de referencia y evaluación para ese montaje.

**PIR o CSI en vivo por MQTT.** Cambiá nombre y contraseña de red en el `config.h` del firmware correspondiente. Revisá `MQTT_HOST`: la computadora puede recibir otra IP al cambiar de red. Recompilá y volvé a cargar. Si backend y broker siguen en la misma computadora, el backend puede conservar `MQTT_HOST=localhost`. Para CSI, repetí la calibración.

**Celular como punto de acceso.** Activá la red compartida en 2,4 GHz y usá su nombre y clave en la configuración de la placa. Para probar solo logs, la computadora puede leer por USB sin formar parte del transporte MQTT. Para MQTT, conectá también la computadora a una red desde la cual pueda comunicarse con la placa y configurá la IP alcanzable del broker. Para MQTT, el punto de acceso debe permitir tráfico entre clientes. Para CSI, debe responder al ping esperado; hay que verificarlo en ese teléfono.

Dejá el celular y las placas quietos, registrá posiciones y comprobá que produce paquetes CSI útiles. El soporte Wi-Fi del teléfono y su configuración pueden cambiar el formato de paquetes; conectarse no garantiza compatibilidad con el análisis HT-LTF actual.

**Celular para abrir la web.** Es una situación diferente. Los scripts actuales fijan frontend y backend en `127.0.0.1`, accesible solo desde la computadora. No alcanza con abrir la IP LAN desde el teléfono. Para exponer la web a la LAN habría que configurar escucha de ambos servicios, URL de API y WebSocket del frontend, CORS y firewall. Esta guía describe el requisito; no modifica esa configuración.

**¿Necesito datos móviles o Internet?** El experimento usa comunicaciones locales. Internet puede ser necesario para instalar herramientas y dependencias, pero no es la fuente de la medición CSI. El ping se dirige al gateway local.

**Reinicio y cambio de lugar.** La configuración compilada sigue guardada en el ESP32. Si conserva exactamente la red y broker válidos, basta alimentarlo. El detector en la computadora debe tener una calibración adecuada al montaje actual.

<!-- PAGE -->

## 19 Diagnóstico paso a paso

Buscá el primer punto del recorrido que no funciona. No uses el último gráfico como única prueba de todas las capas.

| Síntoma | Verificación inmediata | Acción o interpretación |
| --- | --- | --- |
| La placa no aparece | `pio device list` | Revisar cable de datos, puerto y alimentación |
| Upload falla | Puerto abierto en otro programa | Cerrar otros monitores Serial |
| Serial ilegible | Velocidad del proyecto | 921600 para prueba_CSI; 115200 para los dos firmware MQTT |
| No entra a la red | Mensajes Wi-Fi y SSID | Revisar red, clave, banda y seguridad |
| Wi-Fi funciona pero MQTT no | Host del firmware y puerto 1883 | Usar IP LAN del broker; revisar firewall y aislamiento |
| Backend conectado pero caso vacío | `mosquitto_sub` y tópico | Comprobar publicador y JSON |
| Mensajes MQTT inválidos | Consola del backend | Revisar campos y coincidencia de `case_id` |
| CSI recibidos pero no publicados | Contador sin HT-LTF y cola llena | Revisar formato esperado, tasa y pérdidas |
| Calibrar deshabilitado | Muestras recientes y WebSocket | Verificar caso conectado; esperar fin de calibración |
| CSI siempre marca ausencia | Estado y mensaje de calibración | Antes de calibrar la primera vez no hay detección válida |
| No sale CSV de prueba_CSI | Tecla `c` | Activar registro continuo y comprobar el log |
| Hay gráfico pero métricas vacías | Tabla de ensayos | Telemetría no crea ensayos etiquetados |

**Orden de comprobación para MQTT.** Primero Serial confirma Wi-Fi y broker. Después `mosquitto_sub` confirma llegada de JSON. Luego `/api/v1/telemetry/status` confirma procesamiento y aumento de muestras. Por último revisá LIVE, gráficos e historial de la API.

Para mirar todos los tópicos del proyecto:

```bash
mosquitto_sub -h localhost -p 1883 -t 'presence/#' -v
```

En Windows usá comillas dobles si tu terminal no interpreta las simples. Si el broker no está en esa computadora, reemplazá `localhost` por su host real.

Si la web está congelada, verificá que no estés mirando una última detección vieja con el caso desconectado. La aplicación puede conservar el último valor. Si la lectura es reproducida, comprobá además que no terminó el log. No mezcles publicadores del mismo caso: el backend agrupa por `case_id`, no por `source`.

<!-- PAGE -->

## 20 Preparar y ejecutar la muestra

**Antes de salir.** Llevá placas identificadas, sensor y cables de datos. Comprobá qué firmware tiene cada placa. Ejecutá el comando de arranque con anticipación para que complete las descargas y permisos. Prepará también las compilaciones de las placas. Conservá un log conocido y sus notas como respaldo identificado. No dependas de descargar paquetes durante la exposición.

**Al llegar al lugar.** Identificá red y broker, obtené la IP de la computadora y revisá si cambió respecto del firmware. Probá que el ESP32 alcance a Mosquitto. Fijá posiciones de router, receptor y zona de prueba. No hagas la calibración antes de terminar de acomodar el montaje.

**Secuencia sugerida de presentación.**

1. Mostrá el diagrama general. Explicá que las placas adquieren y transmiten, Python procesa y la web visualiza.
2. Ejecutá el script y señalá los tres procesos: broker, backend y frontend. Abrí salud y el contador de muestras para explicar qué comprueba cada uno.
3. Mostrá PIR por MQTT. Movete, observá el cambio y explicá que una persona quieta puede no mantener una detección de movimiento. Usá el monitor Serial si necesitás diagnosticar.
4. Mostrá CSI con router. Explicá los pings, las amplitudes y la publicación. Iniciá calibración, salí del área y esperá el mensaje final.
5. Probá vacío, caminando y quieto con tiempos y posiciones registrados. Observá movimiento, forma y umbrales. Si hay falsas alarmas, registralas en lugar de ocultarlas.
6. Explicá que la comparación cuantitativa necesita ensayos etiquetados y latencia medida. Mostrá los ensayos que efectivamente correspondan al montaje.
7. Mostrá el Caso 3 para comparar ambos sensores a la vez. Presentá los gráficos de logs como trabajo fuera de línea.

**Si falla la prueba en vivo.** Mostrá en qué etapa se corta y diagnosticá con las comprobaciones de la página anterior. Una reproducción de log es un respaldo útil si se anuncia explícitamente. No la presentes como captura del ambiente actual.

**Al terminar.** Guardá las notas y capturas que necesites. Cerrá conexiones Serial antes de retirar las placas. Detené los servicios con `Ctrl+C` y verificá la salida. No borres la base histórica para “limpiar” la demo sin preservar primero los datos necesarios.

<!-- PAGE -->

## 21 Explicación oral y preguntas frecuentes

**Presentación breve.** “Comparamos un sensor PIR con detección basada en CSI Wi-Fi. El PIR entrega un estado digital de movimiento. Para CSI, un ESP32 recibe paquetes del router y obtiene amplitudes por subportadora. Las placas publican por MQTT a Mosquitto. Un backend en Python valida los datos, calcula la detección y guarda telemetría. La página recibe el estado mediante WebSocket. El detector CSI se calibra con la habitación vacía. El Caso 3 muestra PIR y CSI juntos, con estados y gráficos separados, para comparar sus respuestas. El comando de inicio prepara dependencias y levanta los servicios”.

**¿Por qué MQTT?** Porque separa a quienes producen datos de quienes los consumen mediante un broker y tópicos. El ESP32 no tiene que implementar el servidor de la web. Esa elección agrega una pieza que también debe estar disponible y configurada.

**¿La web calcula presencia?** La decisión CSI se calcula en el backend. React muestra resultados, solicita calibración y permite registrar ensayos. La placa convierte la captura en amplitudes.

**¿La calibración arranca al flashear?** No. La placa puede empezar a capturar y publicar; el usuario inicia la calibración desde la web. Reiniciar la computadora o el backend obliga a recuperar una referencia válida.

**¿MQTT genera la señal de presencia?** MQTT transporta amplitudes. La medición CSI sale de paquetes Wi-Fi recibidos. En este caso se genera tráfico con ping al router. No existe una onda de radio separada llamada “señal MQTT”.

**¿Una persona quieta se detecta siempre?** El indicador de forma intenta detectar cambios persistentes respecto del canal vacío. El resultado depende del montaje y requiere ensayos; el código y los tests sintéticos no garantizan éxito en todo ambiente.

**¿El sistema mide respiración o identifica personas?** No hay evidencia suficiente en esta versión para afirmar eso. Tampoco se implementa una clasificación validada de persona frente a cualquier objeto o cambio del ambiente.

**¿Qué pasa si desconecto la red?** Se interrumpe la transmisión y se reintenta la conexión. Los firmware no almacenan toda la adquisición para reenviarla después. El último estado visible no debe interpretarse como medición actual si el caso está desconectado.

**¿La latencia es 500 ms?** Ese es el intervalo nominal de lectura del PIR. La latencia física y extremo a extremo deben medirse aparte.

<!-- PAGE -->

## 22 Evidencia disponible y fuentes para profundizar

**Discrepancia de resultados que sigue abierta.** La documentación anterior mencionaba que una prueba fuera de línea obtuvo 0 % de falsas alarmas y 100 % de detección. Sin embargo, `prueba_CSI/analisis/resultados/resumen.txt` informa para su ejecución guardada 89,3 % de falsas alarmas combinadas en vacío, y 100 % de detección caminando y sentado. No se identificó evidencia que permita atribuir ambas cifras a la misma configuración o resolver la diferencia. No uses el 0 % como resultado consolidado.

**Qué sí indican los tests.** `tests/backend/test_presence_detector.py` verifica comportamiento con señales sintéticas controladas y rutas de calibración. Los tests de integración usan publicaciones controladas. Ayudan a verificar software, no reemplazan medir el rendimiento con las placas, routers y ambiente de la muestra.

**Documentación actualizada.** Antes de esta revisión, `prueba_CSI/README.md` y partes de otras guías describían un backend anterior, que usaba solo la primera amplitud o una integración pendiente. Esos textos fueron actualizados. Para esta edición se dio prioridad a la implementación actual: vector completo, detector de movimiento y forma, firmware CSI MQTT y botón de calibración. El Caso 3 vigente es la vista conjunta y la pantalla USB fue retirada.

**Mapa de archivos para defender el funcionamiento.**

- Arranque: `start.sh`, `scripts/setup.sh`, `start.bat` y `start.ps1`.
- Configuración y ciclo del backend: `backend/app/config.py`, `main.py` y `mqtt.py`.
- Procesamiento y estado: `telemetry.py`, `telemetry_state.py`, `constants.py` y `signal_processing/presence_detector.py` dentro de `backend/app/`.
- Calibración: `backend/app/api/csi.py` y `frontend/src/components/signal/CalibrationPanel.tsx`.
- Visualización: `frontend/src/pages/CsiCasePage.tsx`, `services/websocket.ts` y `config/env.ts`.
- Datos y métricas: `backend/app/database.py`, `repositories/metrics_repository.py` y `schemas/metrics.py`.
- Adquisición: `firmware/pir/`, `firmware/csi_router/` y `prueba_CSI/`.
- Logs: `prueba_CSI/analisis/` y sus archivos de resultados.

**Fuentes técnicas externas.** Se consultaron para distinguir protocolos y formato de radio; los valores operativos de esta guía proceden del código local.

- Espressif, ESP-IDF 4.4.8, Wi-Fi Driver, apartado Wi-Fi Channel State Information: https://docs.espressif.com/projects/esp-idf/en/v4.4.8/esp32/api-guides/wifi.html#wi-fi-channel-state-information
- MQTT.org, descripción del modelo publish/subscribe y niveles QoS: https://mqtt.org/

**Regla para explicar los resultados.** Diferenciá siempre capacidad implementada, captura real, reproducción, prueba sintética y validación física. Si cambia el repositorio, revisá los archivos anteriores antes de reutilizar los detalles de esta edición.

<!-- PAGE -->

## 23 Organización del repositorio y vocabulario

El repositorio reúne programas que se ejecutan en equipos diferentes. Tener todas las carpetas en la computadora no significa que todos sus programas deban cargarse al ESP32.

```text
tp2/
  start.sh                 Arranque en macOS y Linux
  start.bat y start.ps1     Arranque en Windows
  scripts/setup.sh         Preparación automática en Unix
  backend/app/             Programa Python de la computadora
    api/                   Rutas HTTP y WebSocket
    schemas/               Validación de entradas y salidas
    signal_processing/     Detector CSI
    repositories/          Guardado y consultas SQLite
  frontend/src/            Aplicación que utiliza el navegador
    pages/                 Pantallas
    components/            Gráficos, botones y formularios
    services/              Comunicación HTTP y WebSocket
  firmware/pir/            Programa de la placa del PIR
  firmware/csi_router/     Programa de la placa CSI por MQTT
  prueba_CSI/              Captura Serial y análisis de logs
  .tools/ y .runtime/      Herramientas y configuración local
  mosquitto/               Configuración del broker
  tests/                  Verificaciones automáticas
  docs/                   Documentación y esta guía
```

**Firmware y flasheo.** El firmware es el programa que ejecuta la placa. Compilar transforma sus fuentes en un programa ejecutable para el microcontrolador. Flashear o Upload escribe ese programa en la memoria de la placa. Build solamente compila; no cambia lo que está ejecutando una placa hasta cargar el resultado.

**PlatformIO y Arduino.** PlatformIO organiza la compilación, las bibliotecas y la carga. El framework Arduino aporta funciones como `setup`, `loop` y `digitalRead`. El proyecto puede usar ese framework sin utilizar Arduino IDE ni un archivo `.ino`.

**Backend y frontend.** FastAPI define operaciones de la API en Python; Uvicorn es el proceso que las sirve. React organiza las pantallas y ECharts dibuja los gráficos. Vite sirve el frontend durante el desarrollo. No se carga React, Python ni Mosquitto dentro del ESP32.

**Dependencias y resultados.** `backend/.venv` y `frontend/node_modules` contienen bibliotecas instaladas. `frontend/dist` es el resultado de compilar la web. Los scripts de arranque actuales sirven el proyecto mediante Vite, no publican un sitio en Internet. Los archivos de `output/` son entregables; esta edición incluye allí Word y PDF para estudiar y compartir.
