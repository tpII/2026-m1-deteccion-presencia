## 3/9: 
- Se investigó acerca de los distintos casos a implementar.
- Se analizaron alternativas para la interfaz web.
- Se investigó sobre CSI.

## 10/9:
- Definimos objetivos del proyecto
- Definimos requerimientos a cumplir
- Definimos elementos a utilizar
- Redaccion de propuesta inicial

## 17/9:
- Revisamos y ajustamos requerimientos en clase
- Búsqueda  de documentación técnica necesaria para la investigación y desarrollo del proyecto.


## Documentación relevada

| Recurso | Link |
|---------|------|
| Sensor PIR | [ESP8266-MQTT-PIR-Sensor](https://github.com/timmo001/ESP8266-MQTT-PIR-Sensor) |
| HUAWEI CSI | [CSI Sensing - Huawei](https://info.support.huawei.com/info-finder/encyclopedia/en/CSI+Sensing.htmll) |
| Espressif CSI | [esp-csi](https://github.com/espressif/esp-csi) |
| Proyecto ESP32 + CSI WiFi | [HLK-LD2412-POE-WiFi-CSI-security](https://github.com/PeterkoCZ91/HLK-LD2412-POE-WiFi-CSI-security) |

## 18/9
Actividades realizadas
- Revisión y corrección de la sección “Identificación de Partes” del Plan de Proyecto.
- Actualización del listado de materiales, incorporando las cantidades previstas de cada componente y tomando modelos comerciales de referencia para poder especificar sus características técnicas.
- Armado de una tabla comparativa de los componentes del sistema, incluyendo modelo de referencia, descripción, cantidad, precio aproximado, tensión de alimentación, consumo de corriente e imagen del componente.
- Revisión de los requerimientos de alimentación del sistema, diferenciando la tensión de red de 220 V CA de las tensiones de alimentación utilizadas por los distintos dispositivos y sus respectivos adaptadores.
- Incorporación de una fuente de alimentación externa como alternativa opcional para la alimentación independiente del sensor PIR durante las pruebas, en caso de ser necesario reducir posibles interferencias o ruido.
- Revisión de las alternativas para la implementación del sistema de visualización: ThingsBoard, Grafana, Node-RED y desarrollo de una interfaz web propia.
- Definición tentativa del desarrollo de una interfaz web propia como alternativa principal, debido a la flexibilidad necesaria para representar las señales, su procesamiento y la comparación entre los casos de estudio.
- Definición inicial del stack tecnológico para la aplicación web: React, TypeScript y Vite para el frontend; Python y FastAPI para el backend; MQTT con Mosquitto para la recepción de telemetría; WebSocket para la actualización de datos en tiempo real; Apache ECharts para la representación gráfica y SQLite como alternativa inicial de persistencia.
- Definición preliminar de la organización del dashboard, contemplando una vista del procesamiento de la señal y secciones independientes para los casos de estudio y su comparación.
- Implementación del backend en FastAPI con ingesta dual (simulación MOCK interna y broker MQTT Mosquitto), pipeline de procesamiento de señal CSI (filtro Hampel contra outliers, media móvil y varianza) y servidor WebSocket en tiempo real (~8 Hz).
- Integración de persistencia asíncrona en SQLite (`aiosqlite`) para ensayos experimentales con Ground Truth y registro de histórico de telemetría sin bloqueo de streaming.
- Desarrollo del frontend en React 18, TypeScript y Vite con estética Liquid Glass, navegación por vistas de los 3 casos, renderizado dinámico de gráficos en Canvas con Apache ECharts y soporte completo para Modo Oscuro reactivo.
- Creación de suite de pruebas unitarias automáticas (`pytest`), scripts de simulación de nodos ESP32 y orquestación multicontenedor con Docker Compose.

## 19/9
Modificación del plan de proyecto: se definieron nuevos objetivos de éxito en cuanto a la comparacion de metodos (sensor PIR / señal CSI):
- Reducción de falsos negativos: Disminuir en al menos un 80% los falsos negativos del sensor PIR en escenarios de presencia estática, como por ejemplo una persona sentada sin movimientos bruscos durante más de 60 segundos.
- Detección sin línea de visión: Lograr una precisión de detección superior al 85% cuando la persona se encuentra detrás de obstáculos no estructurales (pared de yeso, puertas de madera), que es un escenario donde el PIR tiene 0% de efectividad.
- Latencia de procesamiento: El algoritmo debe procesar la ventana de datos CSI y determinar el estado de presencia en un tiempo inferior a 500 ms.

En cuanto a la visualización web, se definieron las métricas a comparar en tiempo real:
- Estado Binario de Presencia: Indicadores en paralelo del estado actual del PIR (Movimiento/Vacío) vs. CSI (Presencia/Vacío).
- Línea de tendencia de detección: Un gráfico temporal que muestre las "caídas" de detección del PIR (cuando la persona se queda quieta) contrastado con el mantenimiento continuo de la detección del CSI.
- Varianza del Canal: Un gráfico lineal mostrando la perturbación de la amplitud de las subportadoras CSI en crudo, permitiendo visualizar el "ruido" que genera una persona al moverse o respirar.

## 27/9
Investigación y especificaciones del sensor PIR:

<img width="308" height="266" alt="image" src="https://github.com/user-attachments/assets/6740fce4-3d02-4707-8f3e-09f810d127eb" />



| Datasheet PIR|
|---------|
| https://datasheet4u.com/download/775434/HC-SR501.html|

- Tensión de operación: Funciona con un rango de voltaje de entre 5V y 20V de corriente continua (DC).
- Corriente de reposo (estática): Consume menos de 50uA cuando está en espera.   
- Consumo de energía (activo): Su consumo operativo es de 65 mA.   
- Alcance espacial: Tiene una distancia máxima de detección de 7 metros y un ángulo del cono de detección menor a 110 grados.
- Sensibilidad al tipo de movimiento: El sensor funciona mediante una sonda doble (A y B). Es mucho más sensible cuando la persona camina cruzando frente a él (de izquierda a derecha o viceversa) que cuando se mueve directamente hacia el sensor de frente.
- Retardo ajustable (Delay): Se puede ajustar mediante un potenciómetro cuánto tiempo se mantiene la señal en alto tras detectar movimiento, abarcando desde unos 3 segundos hasta 5 minutos.
- Modo de disparo: Posee un puente (jumper) que permite configurar un "disparo repetitivo" (H), el cual viene por defecto y mantiene la salida en alto continuamente mientras detecte actividad humana en su rango.
- Tiempo de bloqueo (Block time): Tras enviar una señal de salida, el sensor entra en un período de bloqueo predeterminado de 2.5 segundos, durante el cual no aceptará ninguna señal nueva.   

## 4/10 — Primera prueba del sensor PIR con ESP32 y visualización web

- Se preparó una prueba del sensor PIR HW-416-B conectado a una ESP32-WROOM-32, con alimentación desde VIN/5V, tierra común y salida digital conectada a GPIO27.
- Se configuró Arduino IDE y se instaló el soporte **esp32 by Espressif Systems**, seleccionando la placa **ESP32 Dev Module**.
- Se cargó un firmware que lee GPIO27 cada 200 ms y transmite `MOVIMIENTO` o `SIN MOVIMIENTO` por USB Serial a 115200 baud.
- Durante la compilación apareció el error **“bad CPU type in executable”** de la herramienta `ctags`. Se identificó una incompatibilidad entre esa herramienta Intel y el Mac Apple Silicon, y se resolvió instalando Rosetta.
- La carga del firmware falló inicialmente a 921600 baud. Se redujo la velocidad de carga a **115200 baud**, tras lo cual la escritura y verificación del firmware finalizaron correctamente.
- Se presentaron problemas de disponibilidad del puerto USB y caracteres ilegibles en el monitor serial. Se revisó la selección del puerto, el uso exclusivo de la conexión y la configuración del monitor a **115200 baud**.
- Se agregó una página independiente **Prueba PIR — USB**, utilizando Web Serial, los servicios, hooks y componentes existentes, sin nuevas dependencias.
- Se implementó el guardado manual de los últimos 50 mensajes en una tabla independiente de SQLite, con consulta del historial y prevención de registros duplicados.
- La compilación del frontend y las pruebas automatizadas finalizaron correctamente: **27 tests del backend y 9 pruebas de lectura serial**.

### Dificultad pendiente

- El sensor continuó informando movimiento durante las pruebas. Se revisaron las conexiones y se propusieron pruebas de ubicación, estabilización y lectura de GPIO27 conectado a GND. **No quedó confirmada la causa ni validado el cambio entre movimiento y ausencia de movimiento.**

## 9/10 — Primera prueba de obtención de señal CSI con ESP32 y router WIFI

Se desarrolló un programa para el ESP32 (PlatformIO, framework Arduino) que conecta la placa como cliente a la red Wi-Fi del router (2,4 GHz).
Para asegurar un flujo constante, el programa envía un ping al router cada 100 ms, y cada respuesta genera un paquete CSI. Se conservan solo los paquetes cuyo origen es la MAC del router. Cada paquete se envía por el puerto serie a la computadora en una línea de texto, con los metadatos de recepción y los valores del CSI. 
El código se encuentra disponible en la carpeta "Prueba_CSI".

Dificultades: Durante las primeras pruebas, la conexión falló por baja señal y se resolvió acercando la placa al router.

Se adjunta imagen del paquete CSI obtenido:

<img width="916" height="221" alt="image" src="https://github.com/user-attachments/assets/78a991af-40a5-4e60-816d-f1a7476c4bf1" />

se logró recibir unos 10 paquetes por segundo, en coincidencia con la frecuencia del ping de 100ms.
Cada paquete CSI tiene dos partes:
Metadatos de recepción: datos que el ESP32 agrega sobre cómo recibió el paquete. Entre ellos están la MAC del router (que permite descartar paquetes de otros dispositivos), el RSSI y una marca de tiempo en microsegundos. No se usan para detectar presencia, pero sirven para filtrar y ordenar las muestras.
CSI propiamente dicho: es la parte que se procesará para detectar presencia. Contiene un valor complejo por cada subportadora, guardado como dos bytes (parte imaginaria y parte real). Cada valor indica cuánto se atenuó y desfasó la señal en esa frecuencia al recorrer el ambiente, por lo que cambia cuando una persona se mueve entre el router y el ESP32.

Queda pendiente comenzar a investigar y aplicar el procesamiento de la señal CSI para obtener resultados de detección de presencia.


## 24/10 — Reorganización del código y mejoras del sistema

- Se reorganizó y simplificó el código del backend y del dashboard, eliminando partes que ya no se utilizaban.
- Se mejoró la visualización en distintas pantallas y se corrigieron errores en los gráficos y el registro de ensayos.
- Se adaptó el proyecto PlatformIO de Bernardo para enviar las lecturas del PIR por Wi-Fi y MQTT, manteniendo la conexión USB.
- Se mejoraron la reconexión y el guardado de datos, y se realizaron pruebas automáticas del sistema con resultados satisfactorios.
- Queda pendiente probar el funcionamiento completo con la ESP32 y el sensor PIR físicos.

## 25/10 — Análisis de CSI (Caso 2)

Se grabaron capturas de CSI del ESP32 conectado al router en tres situaciones: habitación vacía, una persona caminando y una persona sentada quieta. Las grabaciones se analizaron por separado con scripts en Python (se encuentra en prueba_CSI/analisis/). De cada paquete se usaron las amplitudes de las 55 subportadoras útiles del bloque HT-LTF, divididas por el promedio del paquete (perfil).

<img width="2200" height="760" alt="amplitud_subportadoras" src="https://github.com/user-attachments/assets/7239ae6c-c492-42e8-a70d-79737f061d9f" />
Se observó que con la habitación vacía el perfil se mantiene estable, al caminar varía rápido y con una persona quieta queda distinto al de la habitación vacía. A partir de esto se definieron dos indicadores, calculados en ventanas de 4 s:

Movimiento: cuánto varía el canal en el tiempo.
Forma: cuánto se aleja el perfil del medido con la habitación vacía.

Los umbrales se calibran con la habitación vacía, y se detecta presencia si cualquiera de los dos indicadores supera su umbral.

Resultados de la prueba:

<img width="2200" height="1240" alt="indicadores" src="https://github.com/user-attachments/assets/8cf0e163-e943-48f4-ab40-ff5e866af4b5" />

0 % de falsas alarmas, 100 % de detección caminando y 100 % sentado. Con la persona sentada, el indicador de movimiento solo detectó el 96 % del tiempo; el de forma cubrió los momentos de quietud, lo que justifica usar ambos. 

## 31/10 — Prueba Caso 2 usando iPhone como router
Se probó el caso 2 mientras el celular compartía internet y el ESP32 se conectó a esa red. Para que funcionara, hubo que activar en el iPhone la opción “Maximizar compatibilidad”, que hace que la red se cree en la banda de 2,4 GHz, la única que admite el ESP32. Con eso, el ESP32 se conectó, capturó paquetes CSI del celular y los publicó correctamente en la plataforma web.

Es requisito que la computadora donde corren el broker MQTT y el backend esté conectada a la misma red que comparte el celular. El ESP32 envía los datos a la dirección IP local de la computadora, y esa dirección solo es alcanzable dentro de la misma red local. Al cambiar de red, la computadora recibe una IP nueva (en el hotspot del iPhone, del tipo 172.20.10.x), así que hay que actualizar MQTT_HOST en la configuración del firmware (config.h) y volver a cargarlo en la placa.

## 31/10 — Caso conjunto y arranque automático

- El Caso 3 de la web pasa a mostrar PIR y CSI con router juntos, con estados y gráficos separados, reutilizando la calibración del Caso 2. No se implementó una fusión de decisiones.
- Se retiró la pantalla de prueba PIR por USB; se conservan el monitor Serial del firmware y los datos y endpoints históricos del backend.
- El inicio se concentra en `./start.sh` o `.\start.bat`: preparación de herramientas soportadas, entorno Python, dependencias y configuración inicial; arranque y comprobación de broker, backend y frontend.
- Se actualizó la documentación operativa y la guía de la muestra. Los informes y auditorías de fechas anteriores se conservan como registros históricos identificados.
- La instalación de herramientas depende de Internet, permisos y disponibilidad de los gestores. La configuración y carga de los ESP32 y la validación física se realizan por separado.
- Validación de software: 61 pruebas de backend, 22 de frontend y 2 de integración aprobadas; compilación del frontend correcta. Tres pruebas de arranque con puertos fijos se omitieron porque estaban ocupados por servicios existentes. Windows y la instalación desde un sistema sin herramientas quedan pendientes de verificación en equipos de destino.

## 8/11 
- Elaboración de Informe de Avance II

## 21/11 — Registro de mediciones y visualización del Caso 3

- Se reorganizó la vista conjunta de PIR y CSI para consultar en una misma pantalla la señal del PIR, los indicadores de movimiento y forma del canal, la amplitud media de las subportadoras y los mapas de calor de ambiente vacío, caminando y sentado quieto.
- El backend recibe las muestras por MQTT, calcula los indicadores y la detección de presencia de CSI, y guarda automáticamente las lecturas y los resultados en SQLite. También se guarda cada perfil de calibración de CSI con su fecha, hora y ambiente.
- Se incorporaron botones para registrar lo observado durante la prueba, con ambiente y hora con milisegundos. Las marcas se vinculan con las muestras siguientes para identificar falsos positivos y falsos negativos por período de calibración.

## 22/11 _ Problemas con el iPhone como punto de acceso (Caso 2)

Al repetir las pruebas del Caso 2 usando un iPhone como punto de acceso, la detección por CSI funcionó mal. Con la habitación vacía indicaba presencia, y una vez que detectaba a una persona, no volvía a ausencia aunque la habitación quedara vacía. Los umbrales de calibración salieron hasta 10 veces más altos que en las pruebas con router y variaban mucho entre una calibración y otra.

<img width="1107" height="498" alt="image" src="https://github.com/user-attachments/assets/bbbd5a41-1b5f-4171-a158-fa9a4a3def5c" />


<img width="1030" height="455" alt="image" src="https://github.com/user-attachments/assets/7ac91c2d-dac7-4266-9181-f6283c08d31d" />


En la primer imagen, con la habitación vacía, el indicador de movimiento queda todo el tiempo por encima de su umbral y el de forma salta de golpe entre dos niveles (0,55 y 0,09) sin que haya nadie. En la segunda imagen, con una persona caminando, el indicador de forma toma el mismo valor (0,55) que tenía con la habitación vacía, por lo que no permite distinguir entre ambas situaciones.

Para diagnosticarlo, se agregó al firmware un registro de los tipos de paquete recibidos. Se observó que el iPhone cambia constantemente la velocidad de transmisión (MCS) paquete a paquete, y que los paquetes llegan con amplitudes y perfiles distintos según esa velocidad. El sistema interpreta esos cambios como si fueran producidos por una persona. Filtrar los paquetes por velocidad mejoró solo parcialmente el resultado, mejoro el indicador de movimiento pero no el de forma.


## 23/11 — Pruebas

Se realizaron distintas pruebas con el fin de comparar los dos métodos de detección a la vez, realizando distintas situaciones.

Aclaración: En todas las pruebas se uso el router wifi como acceso point para el metodo del csi.

La zona de medición fue configurada de la siguiente forma (imagen explicativa para que se entiendan los videos):

<img width="840" height="525" alt="imagen zona de medicion drawio" src="https://github.com/user-attachments/assets/4a0bb392-2e8e-40f0-a4d5-4b933f49e257" />


Las pruebas realizadas fueron las siguientes (videos en https://drive.google.com/drive/folders/1RMSU0koLPMjxaEGXVrOkOLzCYzQEMD0H?usp=drive_link ):

Prueba 1: pasar caminando por la zona e irme.
Los dos metodos detectaron correctamente. Es notorio que si venis caminando desde lejos sobre la linea de vision del PIR, el PIR detecta antes, mientras que el csi detecta recien cuando te acercas al router o esp correspondientes.

Prueba 2: acercarme a dejar un objeto en la zona de medicion e irme.
Esta prueba se repitio dos veces:
- La primera vez se dejo una silla en la zona de medicion. Mientras estoy dejando la silla me detectan los dos, al dejar la silla e irme el PIR deja de detectar movimiento, mientras que el csi continua detectando presencia. Este resultado es esperable porque esa silla no estaba cuando se hizo la calibración inicial, por lo que llevarla a la zona de medicion distorsiona las ondas csi y esto se ve reflejado en el cambio de los indicadores.
- La segunda vez se probó un objeto mas grande, un sillon. Ocurrió lo mismo, el csi detecta el objeto en la zona (no estaba cuando se hizo la calibracion), mientras que el PIR no lo detecta.

Prueba 3: ir a la zona de medicion, sentarme y quedarme quieto.
Despues de unos segundos, el PIR deja de detectar movimiento mientras que el csi continua detectando presencia.

Prueba 4: Prender un ventilador apuntando a la zona de medición.
Se observaron falsos positivos en el método del CSI.

Prueba 5: caminar por una habitacion de al lado a la habitacion medida (con una pared que separa). Ninguno de los métodos pudo detectar movimiento o presencia en la habitacion de al lado. 

Prueba 6: revolear un objeto a la zona de medicion.
Esta prueba se repitió 3 veces y se obtuvo diferentes resultados:
- La primera vez, el objeto fue arrojado mas cerca del sensor PIR, pasando justo por adelante del mismo, por lo que el PIR lo detecto por uno o dos segundos, luego el CSI tambien lo detectó por unos segundos y despues lo dejo de detectar.
- La segunda vez, el objeto fue arrojado en el medio de la zona de medicion. El PIR no logro detectarlo, aunque paso por su linea de vision, mientras que el CSI si lo detecto continuamente desde que el objeto toco el piso.
- La tercera vez el objeto fue arrojado en el medio nuevamente. Mismos resultados que en el segundo intento de la prueba. 

