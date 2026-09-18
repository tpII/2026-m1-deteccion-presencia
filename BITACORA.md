Semana 3/9: 
- Se investigó acerca de los distintos casos a implementar.
- Se analizaron alternativas para la interfaz web.
- Se investigó sobre CSI.

Semana 10/9:
- Definimos objetivos del proyecto
- Definimos requerimientos a cumplir
- Definimos elementos a utilizar
- Redaccion de propuesta inicial

17/9:
- Revisamos y ajustamos requerimientos en clase

18/9:
- Búsqueda  de documentación técnica necesaria para la investigación y desarrollo del proyecto.


## Documentación relevada

| Recurso | Link |
|---------|------|
| Sensor PIR | [ESP8266-MQTT-PIR-Sensor](https://github.com/timmo001/ESP8266-MQTT-PIR-Sensor) |
| HUAWEI CSI | [CSI Sensing - Huawei](https://info.support.huawei.com/info-finder/encyclopedia/en/CSI+Sensing.htmll) |
| Espressif CSI | [esp-csi](https://github.com/espressif/esp-csi) |
| Proyecto ESP32 + CSI WiFi | [HLK-LD2412-POE-WiFi-CSI-security](https://github.com/PeterkoCZ91/HLK-LD2412-POE-WiFi-CSI-security) |

## 18-09
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
