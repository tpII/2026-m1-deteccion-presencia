# Caso 3 de PIR y CSI en conjunto

El Caso 3 ahora muestra en la misma pantalla el PIR del Caso 1 y CSI con router del Caso 2. Cada sensor conserva su estado y sus gráficos. No se calcula una decisión fusionada ni se considera que sea un tercer sensor.

## Preparar la muestra

1. Programar una placa con `firmware/pir/` y otra con `firmware/csi_router/`, con la red y la IP del broker configuradas en sus respectivos `include/config.h`.
2. Iniciar la aplicación con `./start.sh` en macOS/Linux o `.\start.bat` en Windows. El comando descarga e instala las herramientas y dependencias faltantes que admite el sistema y levanta los servicios; ver [arranque](arranque.md). Ambos nodos deben poder alcanzar al broker.
3. Abrir **Caso 3 — PIR + CSI** en `http://localhost:5173/case/combined`.
4. Verificar que indique **2 de 2 sensores con lecturas** y que aumenten los contadores de ambos sensores. Si llega una sola fuente, esa fuente sigue visible y la otra indica **SIN LECTURA**.
5. Calibrar CSI con el botón de esa pantalla y dejar el ambiente vacío durante el procedimiento. Se utiliza el detector de `csi_router`, compartido con el Caso 2: no hace falta calibrar dos detectores.
6. Comparar ambiente vacío, persona caminando y persona sentada quieta. PIR informa movimiento; CSI muestra la presencia estimada solo cuando está calibrado. Antes de calibrar muestra **SIN CALIBRAR**, **ESPERANDO CALIBRACIÓN** o **CALIBRANDO**.
7. Registrar los resultados de cada método en **Sistema & Hardware**. La comparación cuantitativa conserva columnas de PIR y CSI Router; no genera métricas artificiales para el Caso 3.

El PIR tiene lectura nominal cada 500 ms y el detector CSI usa ventanas de 4 s. Las gráficas mantienen los tiempos y frecuencias propios de cada fuente; compartir una pantalla no sincroniza físicamente las adquisiciones. La latencia sigue figurando como **Sin medir** cuando no se dispone de una medición.

## Comunicaciones y compatibilidad

Se reutilizan los tópicos `presence/pir/telemetry` y `presence/csi/router/raw`, el procesamiento del backend y la conexión WebSocket compartida. No se requiere flashear un programa nuevo llamado “Caso 3”.

Los casos individuales siguen en `/case/pir` y `/case/csi_router`. La antigua dirección `/case/csi_dedicated` redirige al caso conjunto. La pantalla `/test/pir-usb` se eliminó; esa dirección vuelve al resumen general. El diagnóstico Serial sigue disponible en PlatformIO a 115200 baud para los firmware MQTT.

El backend mantiene el contrato y los registros del antiguo caso dedicado y de USB para conservar compatibilidad y datos históricos. La web no ofrece esos métodos para nuevos ensayos ni mezcla su historial con PIR + CSI.

La [guía extensa de la muestra](guia-completa-muestra.md) y sus copias Word/PDF explican el arranque y los tres casos vigentes.
