## 6.1 Firmware desarrollado para prueba del sensor PIR

Se programó el ESP32 en C++ con el entorno Arduino para leer el sensor PIR y enviar sus lecturas a la computadora. En la prueba se utilizó el módulo HW-416-B, conectado de la siguiente manera:

- **VCC:** al pin VIN/5 V del ESP32.

- **GND:** al pin GND del ESP32.

- **OUT:** al pin GPIO27, configurado como entrada digital.

El ESP32 recibe alimentación por USB. Cuando la salida del PIR está en HIGH se registra movimiento (1); cuando está en LOW se registra ausencia de movimiento (0). El sensor no permite confirmar por sí solo la presencia de una persona inmóvil.

El HC-SR501 de la tabla de partes es un modelo de referencia; el módulo utilizado en este montaje fue el HW-416-B.

### Funcionamiento del programa

El programa repite una secuencia de lectura y envío. Las bibliotecas WiFi.h y PubSubClient permiten conectar la placa a la red y publicar los datos mediante MQTT.

- **Conexión:** el ESP32 se conecta a Wi-Fi y luego al broker Mosquitto. El archivo de configuración contiene las credenciales de la red, la IP del servidor y el puerto MQTT (1883).

- **Lectura:** consulta GPIO27 cada 200 ms nominales. Interpreta HIGH como movimiento y LOW como ausencia de movimiento.

- **Comprobación por USB:** imprime cada muestra en el monitor serie a 115200 baud, con el texto MOVIMIENTO o SIN MOVIMIENTO.

- **Envío por MQTT:** si hay conexión, publica un mensaje JSON en presence/pir/telemetry. El mensaje incluye el caso, el identificador de la placa y el estado leído, expresado como valor lógico y como 0 o 1.

- **Recepción:** el backend valida el mensaje, registra la hora de llegada, guarda la lectura y actualiza la interfaz web.

Si se pierde la conexión, el programa vuelve a intentarlo cada 5 segundos. Las muestras se envían con QoS 0 y sin retain: no se confirma su entrega ni se guarda el último mensaje en el broker. Tampoco se almacenan en el ESP32 para reenviarlas. Los reintentos pueden demorar las lecturas, por lo que el intervalo de 200 ms es aproximado.

## 6.3 Interfaz Web

Se desarrolló una interfaz web para observar las lecturas en tiempo real, consultar el historial y registrar ensayos. Está preparada para trabajar con los tres métodos del proyecto. En este avance se comprobó el funcionamiento con el sensor PIR; la integración y comparación de los casos CSI siguen pendientes.

### Recorrido de una lectura

- **Adquisición:** el ESP32 lee el PIR y envía el estado por Wi-Fi mediante MQTT a Mosquitto.

- **Registro:** el backend recibe el mensaje, valida sus datos y guarda la lectura en SQLite.

- **Visualización:** el backend actualiza la web mediante WebSocket. Las consultas al historial y la gestión de ensayos se realizan mediante REST.

### Organización y tecnologías utilizadas

El sistema se divide en una interfaz que muestra los datos y un servidor que los recibe, valida y almacena. El navegador se comunica con FastAPI; la conexión MQTT corresponde al recorrido entre el ESP32, Mosquitto y el backend.

### Interfaz de usuario (frontend)

- **React y TypeScript:** React organiza las pantallas en componentes; TypeScript permite comprobar los tipos de datos utilizados.

- **Vite y React Router:** Vite facilita el desarrollo y la compilación; React Router organiza la navegación entre páginas.

- **CSS y Apache ECharts:** CSS define la presentación y la adapta al tamaño de la pantalla; ECharts representa señales y comparaciones en gráficos.

### Servidor (backend)

- **Python y FastAPI:** implementan las consultas REST y las actualizaciones por WebSocket. Python también permite trabajar con herramientas numéricas como NumPy y SciPy para el procesamiento de CSI.

- **Pydantic y paho-mqtt:** Pydantic valida la estructura de los mensajes; paho-mqtt conecta el servidor con Mosquitto para recibir la telemetría.

- **SQLite:** almacena lecturas y ensayos en una base local, sin requerir un servidor de base de datos adicional.

### Prueba por USB

También se dispone de una página de diagnóstico que lee el puerto serie con Web Serial, en navegadores compatibles. Permite comprobar el sensor y el cableado: el navegador recibe las lecturas por USB y solicita su guardado al backend. El flujo integrado del proyecto utiliza Wi-Fi y MQTT.
