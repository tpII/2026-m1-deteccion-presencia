"""
Algoritmo de deteccion de presencia por CSI (version de analisis, fuera de linea).

Se usan dos indicadores, calculados en ventanas moviles de WINDOW_S segundos:

1. MOVIMIENTO: cuanto fluctua el canal.
   - Turbulencia de cada paquete = desvio / promedio de las amplitudes de las subportadoras.
   - Indicador = desvio de la turbulencia en la ventana.
   Sube mucho cuando alguien camina; con una persona muy quieta puede quedar bajo.

2. FORMA: cuanto se aleja el canal de como era con la habitacion vacia.
   - Perfil de cada paquete = amplitud de cada subportadora / promedio del paquete
     (dividir por el promedio elimina el ajuste automatico de ganancia del chip).
   - Indicador = distancia entre el perfil y el perfil promedio de la calibracion, promediada en la ventana.
   Detecta a una persona quieta, porque su cuerpo cambia los caminos de la senal aunque no se mueva.

Calibracion: con la habitacion vacia se mide cada indicador y se fija
  umbral = promedio + K_SIGMA * desvio   (de la linea base), con un minimo de MIN_RATIO * promedio.
Decision: hay presencia si CUALQUIERA de los dos indicadores supera su umbral.
"""
import numpy as np
import pandas as pd

WINDOW_S = 4.0   # ventana movil (4 s: mejor deteccion de persona quieta, ver analisis)
MIN_PKTS = 5     # paquetes minimos en la ventana para calcular
K_SIGMA = 3.0    # cuantos desvios por encima de la linea base
MIN_RATIO = 1.3  # el umbral nunca queda por debajo de 1,3 x el promedio de la linea base


def _rolling(t, x, how, window_s=WINDOW_S, min_pkts=MIN_PKTS):
    """Estadistico movil en una ventana de TIEMPO (no de cantidad de paquetes)."""
    s = pd.Series(x, index=pd.to_timedelta(t, unit='s')).rolling(f'{int(window_s * 1000)}ms', min_periods=min_pkts)
    return getattr(s, how)().to_numpy()


def turbulence(A):
    """Coeficiente de variacion entre subportadoras, un valor por paquete."""
    return A.std(axis=1) / A.mean(axis=1)


def profile(A):
    """Amplitud de cada subportadora relativa al promedio del paquete."""
    return A / A.mean(axis=1, keepdims=True)


def motion_index(t, A, window_s=WINDOW_S):
    """Indicador de MOVIMIENTO: desvio movil de la turbulencia."""
    return _rolling(t, turbulence(A), 'std', window_s)


def baseline_profile(A_empty):
    """Perfil promedio del canal con la habitacion vacia."""
    return profile(A_empty).mean(axis=0)


def shape_index(t, A, base_profile, window_s=WINDOW_S):
    """Indicador de FORMA: distancia (RMS) entre el perfil de cada paquete y el de la calibracion."""
    d = np.sqrt(((profile(A) - base_profile) ** 2).mean(axis=1))
    return _rolling(t, d, 'mean', window_s)


def calibrate(index_values, k_sigma=K_SIGMA):
    """Umbral a partir de la linea base (habitacion vacia)."""
    v = index_values[~np.isnan(index_values)]
    mu, sd = float(v.mean()), float(v.std())
    return {'mean': mu, 'std': sd, 'threshold': max(mu + k_sigma * sd, MIN_RATIO * mu)}


def detection_rate(flags):
    """Fraccion de instantes con deteccion (ignora los instantes sin dato)."""
    flags = np.asarray(flags)
    return float(flags.mean()) if flags.size else float('nan')
