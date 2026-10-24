> **Texto histórico del avance I.** Describe una versión anterior al refactor del 24/10: incluye el firmware anterior, muestreo de 200 ms y referencias a Arduino IDE. No es la guía del código actual. Para el estado vigente, consultar [arquitectura](../architecture.md), [firmware PIR](../../firmware/pir/README.md) y [contrato MQTT](../mqtt-topics.md). Las afirmaciones de pruebas físicas pertenecen al informe y no constituyen una nueva verificación de hardware.

## 6.1 Firmware desarrollado para prueba del sensor PIR

El firmware se desarrolló en C++ para ESP32 con el framework Arduino. Se utilizó el sensor PIR HW-416-B: VCC a VIN/5 V, GND a GND y OUT a GPIO27. La placa se alimenta por USB. El modelo HC-SR501 de la tabla de partes es una referencia; el módulo utilizado en esta prueba fue el HW-416-B.

```cpp
Serial.begin(115200);
pinMode(PIR_PIN, INPUT);  // PIR_PIN = 27

bool motion = digitalRead(PIR_PIN) == HIGH;
Serial.println(motion ? "MOVIMIENTO" : "SIN MOVIMIENTO");
```

La entrada digital se interpreta como 1 cuando la salida está en HIGH y como 0 cuando está en LOW. Serial a 115200 baud permite verificar la lectura desde la computadora. El PIR informa cambios asociados al movimiento; no confirma por sí solo la presencia de una persona inmóvil.

### Comunicación y toma de muestras

La versión MQTT utiliza WiFi.h para conectar el ESP32 a la red y PubSubClient para publicar en Mosquitto. El archivo de configuración define las credenciales, la IP del servidor, el puerto 1883 y el tópico presence/pir/telemetry. El inicio de las conexiones se realiza en setup:

```cpp
WiFi.mode(WIFI_STA);
WiFi.setAutoReconnect(true);
WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
mqttClient.setServer(MQTT_HOST, MQTT_PORT);
```

El programa mantiene las conexiones y toma una lectura cada 200 ms nominales mediante millis(). Imprime cada muestra por Serial, aunque el estado no cambie, y la publica cuando hay conexión:

```cpp
if (now - lastSample >= SAMPLE_INTERVAL_MS) {
  lastSample = now;
  bool motion = digitalRead(PIR_PIN) == HIGH;
  Serial.println(motion ? "MOVIMIENTO" : "SIN MOVIMIENTO");
  if (WiFi.status() == WL_CONNECTED && mqttClient.connected()) {
    publishReading(motion);
  }
}
```

Cada mensaje JSON identifica el caso y la placa, e incluye el estado lógico y su valor numérico. Ejemplo de una lectura con movimiento:

```json
{"case_id":"pir","source":"pir-<id>",
 "presence":true,"raw_value":1}
```

```cpp
mqttClient.publish(MQTT_TOPIC, payload, false);
```

El backend valida el mensaje, registra la hora de recepción, almacena la lectura y actualiza la web. El firmware reintenta las conexiones cada 5 segundos. Publica con QoS 0 y sin retain; no conserva las muestras para reenviarlas tras una desconexión. Los reintentos pueden demorar el muestreo, por lo que 200 ms no es una garantía de tiempo real estricto.

### Problemas encontrados y alcance del avance

En macOS, el error de compatibilidad de la herramienta ctags se resolvió con Rosetta. La carga falló inicialmente a 921600 baud y se completó al reducir la velocidad a 115200. Los caracteres ilegibles del monitor se corrigieron configurándolo también a 115200 baud. Para cargar el programa, el puerto debe estar disponible y corresponder a la placa conectada.

Tras revisar el cableado y repetir las pruebas, se confirmaron lecturas 0 y 1 tanto por Serial como en la web mediante MQTT. Arduino IDE se utiliza para cargar o modificar el firmware; después, el ESP32 ejecuta el programa mientras tenga alimentación. Esta comprobación verifica el flujo de datos, pero todavía no determina precisión, falsos positivos, falsos negativos ni latencia medida.

## 6.3 Interfaz Web

Se desarrolló una interfaz web propia para visualizar las lecturas, consultar el historial y comparar los tres métodos del proyecto. Se eligió esta alternativa por su flexibilidad para representar los ensayos PIR y CSI. En este avance se verificó el Caso 1 con el sensor real; la comparación experimental con los casos CSI sigue pendiente.

### Arquitectura del sistema

PIR → ESP32 → Wi-Fi/MQTT → Mosquitto → Python/FastAPI
→ validación y almacenamiento SQLite → REST/WebSocket → React

MQTT comunica el dispositivo con el servidor a través de Mosquitto. El backend recibe y valida la telemetría, almacena las lecturas y entrega los datos a la interfaz. WebSocket permite actualizar el estado en vivo; REST se utiliza para consultar registros y gestionar los ensayos. El navegador se comunica con FastAPI, sin suscribirse directamente al broker MQTT.

### Frontend: React, TypeScript y CSS

React permite organizar la interfaz en componentes reutilizables y actualizar las vistas cuando llegan nuevas lecturas. TypeScript agrega comprobaciones de tipos sobre JavaScript y ayuda a mantener consistentes los datos recibidos del servidor. Vite facilita el desarrollo y la compilación; React Router organiza la navegación. CSS define la presentación y adapta las pantallas a computadoras y dispositivos móviles. Apache ECharts representa señales temporales y comparaciones entre métodos.

### Backend: Python y FastAPI

Se eligió Python por la disponibilidad de herramientas para procesamiento numérico, como NumPy y SciPy, necesarias para trabajar con CSI. FastAPI reúne la API REST y la comunicación WebSocket. Pydantic valida la estructura de los mensajes recibidos y el cliente paho-mqtt conecta el servidor con Mosquitto. Esta separación permite modificar el procesamiento sin incorporar esa lógica a las pantallas.

### Comunicación y persistencia

MQTT desacopla los nodos que publican telemetría del backend que la recibe. Mosquitto funciona como intermediario y permite utilizar el mismo canal de adquisición para los tres casos. SQLite guarda lecturas y ensayos en una base local sencilla, adecuada para esta primera etapa y sin requerir otro servidor. El backend concentra el acceso a esos registros y los expone a la web mediante REST y WebSocket.

### Prueba USB y alcance de la validación

Además del flujo MQTT, se conserva una página de diagnóstico que lee Serial por USB mediante Web Serial en navegadores compatibles. En esa prueba, la lectura en vivo se realiza desde el navegador y el guardado se solicita al backend. Esta vía permite revisar el sensor y el cableado; el flujo integrado del proyecto utiliza Wi-Fi, MQTT y FastAPI.

Con el PIR real se confirmaron estados 0 y 1 por Serial y en la web mediante MQTT. El sistema permite registrar ensayos con una referencia de presencia indicada por el usuario para calcular métricas; las lecturas del sensor por sí solas no demuestran exactitud. No se presentan resultados simulados ni se afirma haber validado aún la detección CSI o el desempeño comparativo de los tres casos.

## Notas de revisión

- Se contrastó el texto con el firmware `firmware/pir_mqtt/pir_mqtt.ino`, su configuración de ejemplo y los servicios de adquisición, almacenamiento y WebSocket del backend, además de las páginas del frontend.
- Confirmación del grupo: lecturas reales 0 y 1 por Serial y en la web mediante MQTT. No se infieren mediciones de precisión o latencia de esa comprobación.
- Se corrigieron las referencias a una conexión directa navegador–broker: el navegador usa REST/WebSocket con FastAPI; MQTT corresponde al recorrido ESP32–Mosquitto–backend. Se ajustaron los tres esquemas de arquitectura.
- Se corrigieron menciones desactualizadas a simulación, recepción MQTT todavía no probada, publicación Serial solo al cambiar de estado y backend limitado al almacenamiento.
- Se aclaró que el módulo utilizado fue HW-416-B, mientras que HC-SR501 figura como modelo de referencia en la tabla de partes.
- En 6.2 se corrigió la equivalencia entre tamaño del búfer y subportadoras, y el descarte condicional de los primeros cuatro bytes. Fuente: documentación oficial ESP-IDF, sección Wi-Fi CSI: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/wifi-driver/wifi-vendor-features.html
- Se actualizó el índice y la numeración final al agregar una página de firmware.

### Pendientes del documento original

- Adjuntar las fotografías de conexión del PIR y una captura de las lecturas reales por MQTT (sección 7). La imagen del informe original se conserva, identificada como histórica.
- Revisar las referencias de compra [3] a [8]: sus enlaces están presentes, pero algunos modelos no coinciden con la tabla. Por ejemplo, [3] apunta a ESP32-S3, [5] a un router Hikvision y [7] a cables macho-macho. Agregar fechas de consulta. El enlace Huawei [1] termina en `htmll`; la página no pudo verificarse con esta dirección y debe revisarse antes de entregar.
- Verificar el acceso a la carpeta de videos para quienes evaluarán el informe.
- Realizar los ensayos controlados PIR/CSI para medir precisión, falsos positivos, falsos negativos y latencia. Los objetivos de desempeño de la propuesta todavía no son resultados experimentales.
