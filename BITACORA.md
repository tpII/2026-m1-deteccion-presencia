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

## 9/10 - Primera prueba de obtención de señal CSI con ESP32 y router WIFI

se desarrolló un programa para el ESP32 (PlatformIO, framework Arduino) que conecta la placa como cliente a la red Wi-Fi del router (2,4 GHz).
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


