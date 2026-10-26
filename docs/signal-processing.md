# Procesamiento de Señal — Detección por CSI Wi-Fi y PIR

Este documento describe la base teórica y el algoritmo utilizado para detectar presencia humana en interiores.

---

## 1. Fundamentos Físicos

### Sensor PIR
El sensor piroeléctrico capta radiación infrarroja centrada en $\approx 10\,\mu\text{m}$ (longitud de onda emitida por la temperatura corporal humana $\approx 37^\circ\text{C}$). 
La lente de Fresnel divide el campo de visión en conos alternados; cuando una persona se desplaza, la diferencia de irradiación entre los dos elementos piroeléctricos genera un pulso de voltaje analógico que un comparador digitaliza a nivel alto ($1$).
- **Limitación intrínseca**: Si la persona se detiene por completo o duerme, $\frac{\mathrm{d}T}{\mathrm{d}t} \to 0$ y la señal cae a ausencia ($0$).

### Wi-Fi Channel State Information (CSI)
Los estándares 802.11n utilizan modulación OFDM (Orthogonal Frequency Division Multiplexing). A diferencia del RSSI (que es un único escalar grosero de potencia agregada), el CSI describe la respuesta al impulso del canal radioeléctrico en el dominio de la frecuencia para cada subportadora:

$$H(f, t) = |H(f, t)| e^{j \angle H(f, t)}$$

Donde $|H|$ es la amplitud y $\angle H$ es la fase de la subportadora.
El cuerpo humano, compuesto en un 70% de agua salina, actúa como un reflector y dispersor dieléctrico de ondas de radio a 2.4 GHz. Cualquier movimiento o respiración altera los trayectos multicamino (*multi-path reflections*), modulando constructiva y destructivamente la amplitud y fase de las subportadoras.

---

## 2. Detector CSI (`backend/app/signal_processing/presence_detector.py`)

El ESP32 (`firmware/csi_router`) publica por cada paquete del router la amplitud $|H(k)|$ de 55 subportadoras del campo HT-LTF ($k = -28 \dots 28$, sin $k = 0$ ni $k = 1$), unas 10 veces por segundo. El backend calcula dos indicadores sobre una ventana móvil de **4 s**:

```
[ Amplitudes |H(k)| de cada paquete ]
       │
       ▼
[ Normalización ] ──► se divide por la amplitud media del paquete (quita el ajuste de ganancia del chip)
       │
       ├──► Indicador de MOVIMIENTO: desvío, en la ventana, de la turbulencia (desvío / media entre subportadoras)
       └──► Indicador de FORMA: distancia RMS entre el perfil del paquete y el perfil de la habitación vacía
       │
       ▼
[ Umbrales calibrados en el lugar ] ──► PRESENCIA si cualquiera de los dos supera su umbral
```

- **Movimiento** sube mucho cuando una persona camina.
- **Forma** detecta también a una persona quieta: su cuerpo cambia los caminos de la señal aunque no se mueva.

### Calibración

Los valores de CSI dependen del router, de las posiciones y de la habitación, así que los umbrales se fijan en el lugar:

1. Desde la página del Caso 2 se presiona **Calibrar** (`POST /api/v1/csi/{case_id}/calibration`).
2. Hay 10 s para salir de la habitación y luego se registran 30 s con la habitación vacía.
3. Se guarda el perfil promedio del canal vacío y, para cada indicador, umbral = promedio + 3 desvíos de la línea base (como mínimo 1,3 veces el promedio).

Durante la calibración no debe haber nadie cerca: el CSI también percibe movimiento fuera de la habitación.

### Validación con grabaciones reales

El algoritmo se ajustó fuera de línea con grabaciones del ESP32 (`prueba_CSI/analisis`): con ventana de 4 s se obtuvo 0 % de falsas alarmas con la habitación vacía y 100 % de detección caminando y sentado quieto. Con ventana de 2 s, la detección de la persona quieta bajaba al 84 %.
