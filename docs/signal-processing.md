# Procesamiento de señal

El código está en `backend/app/signal_processing/`. Solo hay dos archivos: `filters.py` y `pipeline.py`.

## PIR

El firmware PlatformIO lee GPIO27 con `INPUT_PULLDOWN` cada 500 ms nominales y envía su nivel digital. El backend lo guarda y lo muestra sin filtros CSI. Una salida baja indica que el sensor no detectó movimiento; no demuestra que el ambiente esté vacío.

## CSI

El backend toma la **primera amplitud** de cada mensaje MQTT y reúne hasta 30 muestras recientes de ese método. Cada ventana pasa por estas etapas:

1. **Hampel:** ventana centrada de 7 muestras. Reemplaza valores que se alejan de la mediana más de `3 × 1.4826 × MAD`, donde MAD es la mediana de las desviaciones absolutas.
2. **Media móvil:** promedio centrado de 5 muestras, extendiendo los bordes para conservar la longitud.
3. **Características:** varianza y energía media cuadrática de los últimos 20 valores filtrados, o los disponibles si hay menos.
4. **Score:** función sigmoide de la diferencia entre varianza y umbral, con pendiente 1.2 y diferencia limitada entre −10 y 10.
5. **Detección:** presencia cuando la varianza alcanza el umbral. El score de 0.5 corresponde a ese mismo límite.

Los umbrales iniciales son 2.2 para router y 1.8 para el enlace dedicado. Se ajustan al crear los pipelines en `backend/app/telemetry.py`; requieren calibración con mediciones reales.

Los metadatos del filtro se envían a la web junto con la señal cruda y filtrada. Los buffers conservan hasta 500 puntos; cada actualización muestra los últimos 100.

## Clasificación experimental

El pipeline también calcula periodicidad mediante FFT y asigna etiquetas heurísticas: `empty`, `object_fan`, `object_moved`, `person_active` o `person_static`.

Estas reglas no están validadas con ensayos físicos del proyecto. Las etiquetas no prueban que se pueda distinguir una persona de un objeto o detectar respiración. La decisión binaria actual depende de la varianza; la etiqueta es información adicional.

Todavía faltan los firmware de captura CSI. Para evaluar el método hay que recibir datos físicos, calibrar los umbrales y comparar la detección con presencia observada independientemente.
