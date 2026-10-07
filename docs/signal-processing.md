# Procesamiento de Señal — Detección por CSI Wi-Fi y PIR

Este documento describe la base teórica y la implementación del pipeline de señal utilizado para discernir presencia humana en interiores.

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

## 2. Etapas del Pipeline de Señal (`SignalProcessingPipeline`)

```
[ Señal Cruda ]
       │
       ▼
[ Filtro de Hampel ] (Ventana = 7, 3σ)  ──► Elimina picos impulsivos / outliers de RF
       │
       ▼
[ Media Móvil ] (Ventana = 5)           ──► Suprime ruido térmico de alta frecuencia
       │
       ▼
[ Extracción de Características ]       ──► Varianza temporal y Energía de la señal
       │
       ▼
[ Función de Score & Umbral ]          ──► Sigmoide normalizada (0 a 1) y Decisión
       │
       ▼
[ PRESENCIA / AUSENCIA ]
```

### Etapa 1: Filtro de Hampel
Reemplaza los valores anómalos transitorios producidos por ruidos de canal o paquetes corruptos por la mediana local, utilizando la Desviación Absoluta de la Mediana (MAD):

$$\text{MAD} = \text{median}(|x_i - \tilde{x}|)$$
$$\text{Umbral} = 3 \times 1.4826 \times \text{MAD}$$

Si $|x_i - \tilde{x}| > \text{Umbral}$, se reemplaza $x_i$ por $\tilde{x}$.

### Etapa 2: Filtro de Media Móvil (Moving Average)
Suaviza las pequeñas perturbaciones térmicas preservando las envolventes inducidas por desplazamientos corporales:

$$y[n] = \frac{1}{M} \sum_{k=0}^{M-1} x[n-k]$$

### Etapa 3: Extracción de Características
- **Varianza Temporal ($\sigma^2$)**:
  Se calcula sobre las amplitudes capturadas. Los umbrales iniciales del pipeline deben calibrarse con mediciones del ambiente; no constituyen resultados experimentales.
- **Energía de la Señal ($E$)**:
  Energía cuadrática media normalizada en ventana deslizante.

### Etapa 4: Clasificador y Función de Score
Se calcula un puntaje continuo mediante función logística acotada:

$$\text{Score} = \frac{1}{1 + e^{-k \cdot (\sigma^2 - \text{Umbral})}}$$

Si $\text{Score} \ge 0.5$, se emite el estado **PRESENCIA**; de lo contrario, **AUSENCIA**.

---

## 3. Adquisición desde hardware

- **Ingesta de hardware (MQTT)**: El backend recibe amplitudes reales por MQTT según el contrato de `mqtt-topics.md`. Todavía falta implementar los firmware CSI de los casos 2 y 3. Sin esos nodos publicando, no se generan muestras.
