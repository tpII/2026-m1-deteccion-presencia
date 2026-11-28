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


## 25/11 — Procesamiento de datos obtenidos en prueba conjunta PIR + CSI 

Se realizaron pruebas para almacenar datos en la BD y posteriormente procesarlos.

Con el router Wi-Fi como emisor, el PIR y el CSI funcionando en simultáneo y el CSI calibrado previamente con la habitación vacía, se realizó la siguiente secuencia, de unos 6 minutos en total:

1. Habitación vacía (60 seg).
2. Persona caminando por la zona (60 seg).
3. Persona sentada quieta (60 seg).
4. Persona quieta fuera del campo de visión del PIR (60 seg).
5. Persona fuera de la habitación (60 seg).
6. Persona caminando nuevamente (60 seg).

En cada cambio de situación se marcó desde la web los indicadores agregados recientemente (presente o ausente) en los paneles de ambos sensores:

<img width="915" height="372" alt="imagen_indicadores drawio" src="https://github.com/user-attachments/assets/fe0dc8c9-1a71-4995-9e58-4ab782631820" />

Cada vez que se presiona uno de los botones indicadores, la web envía la marca al backend, que la guarda como una nueva fila en la tabla observations de la base de datos, con estos datos:

- el sensor al que corresponde (case_id: PIR o CSI);
- la situación marcada (scenario: por ejemplo, presente o ausente);
- el ambiente de la prueba (environment);
- la hora de la marca (observed_at);
- un identificador de la ejecución del backend (run_id).

Para finalizar la prueba luego del paso 6, se precionó el botón "Terminar observación" que guarda una fila sin situación, indicando el fin de la observación. Cada marca se aplica a todas las muestras de ese sensor que llegan después de su hora, hasta la marca siguiente. Además, se anotó a mano la hora de inicio de cada situación, para distinguir los tramos que comparten la misma marca, como "caminando" y "sentado quieto", que se registran ambos como presencia.

Para hacer el procesamiento de los datos, se buscó en las siguientes tablas de la base de datos SQLite:

- telemetry: cada muestra recibida de ambos sensores, con su hora y si detectó presencia. En el CSI incluye además los indicadores de movimiento y forma. En la prueba se registraron unas 10 muestras por segundo del PIR y unas 20 del CSI.
- observations: las marcas de presencia real registradas desde la web.
- csi_calibration_events: la calibración del CSI utilizada (umbral de movimiento 0,041 y de forma 0,077).

*Aclaración: si bien el ping al router se mantuvo cada 100 ms (10 por segundo), el ESP32 obtiene el CSI de todos los paquetes que recibe del router. Además de las respuestas al ping, recibe las confirmaciones de la conexión MQTT por cada mensaje que publica, lo que duplica la cantidad de muestras (20 por segundo). Esto no favorece al CSI en la comparación, porque resultados no se expresan como cantidades absolutas de muestras, sino como proporción, es deicr, muestras que detectaron presencia sobre el total de muestras de cada sensor en ese tramo. Como las muestras llegan distribuidas de forma pareja en el tiempo, esa proporción equivale al porcentaje del tiempo con presencia detectada, independientemente de si el sensor entrega 10 o 20 muestras por segundo.


Resultados:

Se graficó una linea de tiempo con la detección de cada sensor e indicadores del CSI durante los 6 minutos de prueba.
<img width="2200" height="1140" alt="linea_de_tiempo" src="https://github.com/user-attachments/assets/ba276196-ce25-4985-9169-874c04d5aaee" />

Se observa que con la persona caminando, ambos sensores detectaron la presencia casi todo el tiempo. Con la persona quieta, el PIR la perdió durante gran parte del tiempo, mientras que el CSI la siguió detectando. En ese tramo, el indicador de movimiento del CSI cae por debajo de su umbral, y es el indicador de forma el que mantiene la detección (esto indica que no hay movimiento pero la señal CSI se distorsiona por lo que se detecta presencia).

Se calculó el porcentaje del tiempo con presencia detectada en cada situación:

| Situación | Real | PIR | CSI |
|---|---|---|---|
| Habitación vacía | Ausente | 0 % | 0 % |
| Caminando | Presente | 96 % | 99 % |
| Sentado quieto | Presente | 56 % | 100 % |
| Quieto fuera del PIR | Presente | 37 % | 100 % |
| Fuera de la habitación | Ausente | 6 % | 10 % |
| Caminando | Presente | 100 % | 98 % |

Por último, se calcularon las respectivas matrices de confusión del PIR y del CSI. Para realizar este calculo, cada muestra se clasifica según la presencia real (marcada desde la web) y la presencia detectada por el sensor:

- **Verdadero positivo (VP):** había alguien y el sensor lo detectó.
- **Falso negativo (FN):** había alguien y el sensor no lo detectó.
- **Falso positivo (FP):** no había nadie y el sensor detectó presencia.
- **Verdadero negativo (VN):** no había nadie y el sensor no detectó presencia.

A partir de estos valores se calculan:

- **Sensibilidad** = VP / (VP + FN): de todo el tiempo en que hubo alguien, qué porcentaje lo detectó el sensor.
- **Especificidad** = VN / (VN + FP): de todo el tiempo en que no hubo nadie, qué porcentaje el sensor indicó correctamente ausencia.
- **Exactitud** = (VP + VN) / total: qué porcentaje del tiempo total el sensor acertó.

<img width="1800" height="681" alt="matrices_confusion" src="https://github.com/user-attachments/assets/d4ae5eb0-b5e4-488b-96fd-a2920c1088a0" />


En cuanto a los tiempos de respuesta, al entrar a la habitación el PIR detectó entre 4 y 6 s antes que el CSI. La causa principal es porque durante toda la prueba, la persona ingresó por el campo de visión del PIR, que la detecta a varios metros de distancia, mientras que el CSI es más sensible cerca de la línea entre el router y el ESP32, por lo que recién detectó al acercarse a esa zona. A esto se suma que el CSI calcula sus indicadores sobre una ventana de 4 s, lo que agrega una pequeña demora. Por lo tanto, esta diferencia depende de la ubicación de los equipos y del recorrido, y no solo del tiempo de respuesta de cada sensor.


## 28/11 — Rehaciendo el procesamiento de datos en prueba conjunta PIR + CSI 

En el primer análisis, cada sensor se evaluó con sus propias muestras, tal como llegaban a la base de datos. Pero cada método entrega datos a un ritmo distinto, según su funcionamiento interno. Por un lado, el PIR publica una lectura de su pin cada 100 ms (10 por segundo). Por otro lado, el CSI genera una decisión por cada paquete recibido del router (20 paquetes por segundo). Así, las matrices de confusión de cada sensor se armaban con unidades distintas y con una cantidad de casos diferente ( 3.500 muestras para el PIR y más de 7.000 para el CSI), lo que genera una comparación no equitativa entre ambos métodos.

Para abordar esta problemática de comparación no equitativa se optó por dejar que cada método tenga sus tiempos de deteccion internos propios durante las mediciones en vivo, y que el muestreo equitativo se realice durante el post procesamiento de los datos de la BD.
Se implementó, en el script de análisis, una grilla temporal común de 500 ms. Se tomó un instante cada 500 ms a lo largo de la prueba, lo que dio 698
 instantes en total. En cada uno se tomó el último dato de cada metodo de sensado recibido antes de ese momento (tabla telemetry), que representa su estado vigente, y se lo comparó con la presencia real registrada para ese instante (tabla observations). Esto equivale a que ambos sistemas decidan en los mismos instantes, como lo haría un reloj común en vivo. De esta forma, ambos métodos quedaron evaluados sobre los mismos 698 instantes, con el mismo N en las dos matrices de confusión.

<img width="2200" height="1251" alt="linea_de_tiempo_grilla" src="https://github.com/user-attachments/assets/12b69148-c5df-4781-b27f-4faeb9559841" />
 

<img width="1880" height="751" alt="matrices_confusion_grilla" src="https://github.com/user-attachments/assets/6f5860e2-8df5-41c9-8dad-54c1a4f6bb0d" />


Los resultados obtenidos con la grilla común son muy similares a los del análisis anterior, por ejemplo, la sensibilidad del PIR se mantuvo en 72 % y la del CSI pasó de 99 % a 100 %. La mayor diferencia se dio en la especificidad del PIR, que pasó de 97 % a 99 %. Esto indicaria que la diferencia en la cantidad de muestras por segundo de cada método no había sesgado la comparación inicial, ya que en ambos casos los resultados reflejan la proporción del tiempo en que cada sensor detectó presencia.
De igual manera, este nuevo procesamiento permite que ambos métodos se evalúen sobre los mismos instantes y con el mismo N, por lo que la comparación es equitativa por construcción y no depende de la frecuencia con la que cada sensor entrega sus datos. 


Las latencias de entrada y salida se calcularon aparte, con las horas originales de la base de datos, para que la grilla no les agregue demora.

| Evento | PIR | CSI | Diferencia (CSI − PIR) |
|---|---|---|---|
| Entrada 1 | 10:42:53,2 | 10:42:57,6 | CSI 4,4 s después |
| Salida | 10:46:32,5 | 10:46:21,2 | CSI 11,3 s antes |
| Entrada 2 | 10:47:30,2 | 10:47:36,4 | CSI 6,1 s después |

Al entrar, el PIR detecta antes, y al salir, el CSI vuelve antes a ausencia. El PIR tarda 11 s más. 


## 28/11 — Obtención de métricas usando iPhone como access point en el método del CSI

Con el fin de documentar las métricas del funcionamiento del método CSI usando el iPhone como punto de acceso, se realizó una prueba conjunta con el PIR, en el mismo ambiente y con el mismo montaje que la prueba con router, reemplazando el router por el iPhone. Antes de comenzar, se calibró el CSI con la habitación vacía. La prueba duró unos 5 minutos, con la siguiente secuencia:

1. Habitación vacía (60 seg).
2. Persona caminando por la zona (60 seg).
3. Persona quieta fuera del campo de visión del PIR (80 seg).
4. Persona fuera de la habitación (60 seg).
5. Persona caminando nuevamente (60 seg).

En cada cambio de situación se marcó la presencia real desde la web, en los paneles de ambos sensores.

Los datos se procesaron igual que en la prueba con router, con la grilla temporal común de 500 ms. Se evaluaron 364 instantes para ambos sensores.

<img width="1880" height="758" alt="matrices_confusion_grilla_con_iphone" src="https://github.com/user-attachments/assets/df81b2ee-5c25-430e-893b-7a7a49df7841" />

<img width="2200" height="1237" alt="linea_de_tiempo_grilla_con_iphone" src="https://github.com/user-attachments/assets/24a588fd-408a-426f-8e59-628c0a58115d" />



| Situación | Real | PIR | CSI |
|---|---|---|---|
| Vacío | Ausente | 0/63 (0 %) | 54/63 (86 %) |
| Caminando | Presente | 70/70 (100 %) | 46/70 (66 %) |
| Sentado al costado del PIR | Presente | 7/118 (6 %) | 44/118 (37 %) |
| Afuera | Ausente | 0/76 (0 %) | 65/76 (86 %) |

El CSI con el iPhone no distingue entre presencia y ausencia. Con la habitación vacía indicó presencia el 86 % del tiempo, y con la persona caminando, solo el 66 %. Su exactitud (33 %) es peor que la de una decisión al azar.
El indicador de movimiento queda inutilizado, la calibración fijó su umbral en 0,237, unas 6 veces más alto que con el router, y el indicador nunca lo alcanzó (osciló alrededor de 0,12), estuviera o no la persona. Todas las detecciones del CSI vinieron del indicador de forma, que oscila alrededor de su umbral (0,364) sin relación con la presencia real.
El PIR funcionó como siempre, detectó al caminar y no tuvo falsas alarmas, pero perdió a la persona sentada (6 %), porque estaba quieta y al costado de su campo de visión.
