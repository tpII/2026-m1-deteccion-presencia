"""
Analisis de deteccion de presencia por CSI sobre un .log del monitor de PlatformIO.

Uso:
  1) Ver los tramos grabados (cada vez que se presiono 'c'):
       python analizar_csi.py archivo.log

  2a) Grabacion con un tramo por situacion (presionando 'c' entre cada una):
       python analizar_csi.py archivo.log --vacio 1 --caminando 2 --sentado 3 [--recorte-vacio 10:140]

  2b) Grabacion continua (un solo tramo), indicando los segundos de cada situacion:
       python analizar_csi.py archivo.log --tiempos "vacio=0:120,caminando=125:185,sentado=195:300"

  Opcional: --calibracion 10:50  -> segundos del tramo vacio usados para calibrar
            (por defecto, la primera mitad). El resto del tramo vacio mide las falsas alarmas.

Genera en la carpeta 'resultados/' (o la indicada con --salida):
  - indicadores.png            : indicadores de movimiento y de forma, con sus umbrales
  - amplitud_subportadoras.png : perfil de las subportadoras en el tiempo (mapa de calor)
  - resumen.txt                : umbrales y porcentaje de deteccion de cada situacion

Requiere: pip install numpy pandas matplotlib
"""
import argparse
import os

import numpy as np

from csi_parse import parse_log, amplitudes
from csi_detect import (WINDOW_S, K_SIGMA, motion_index, baseline_profile, shape_index,
                        calibrate, detection_rate)

from csi_plots import NAMES, plot_indicators, plot_profiles


def list_segments(segments):
    print('Tramos encontrados (cada vez que se activo la impresion con "c"):')
    for i, s in enumerate(segments):
        t, _, _ = amplitudes(s['packets'])
        dur = t[-1] if len(t) else 0
        print(f'  {i}: {s["start"]} -> {s["end"]}  {len(s["packets"]):5d} paquetes  {dur:6.1f} s')


def parse_range(text):
    a, b = text.split(':')
    return float(a), float(b)


def parse_times(text):
    out = {}
    for item in text.split(','):
        key, rng = item.split('=')
        out[key.strip().lower()] = parse_range(rng)
    return out


def load_cases(args, segments):
    """Devuelve {clave: (t, A, ks)} con el tiempo de cada situacion empezando en 0."""
    cases = {}
    if args.tiempos:
        seg = max(segments, key=lambda s: len(s['packets']))  # la grabacion continua
        t, A, ks = amplitudes(seg['packets'])
        for key, (a, b) in parse_times(args.tiempos).items():
            m = (t >= a) & (t < b)
            cases[key] = (t[m] - a, A[m], ks)
    else:
        for key in ('vacio', 'caminando', 'sentado'):
            idx = getattr(args, key)
            if idx is None:
                continue
            t, A, ks = amplitudes(segments[idx]['packets'])
            if key == 'vacio' and args.recorte_vacio:
                a, b = args.recorte_vacio
                m = (t >= a) & (t < b)
                t, A = t[m] - a, A[m]
            cases[key] = (t, A, ks)
    return cases


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('log')
    ap.add_argument('--vacio', type=int)
    ap.add_argument('--caminando', type=int)
    ap.add_argument('--sentado', type=int)
    ap.add_argument('--recorte-vacio', type=parse_range, default=None)
    ap.add_argument('--tiempos', default=None)
    ap.add_argument('--calibracion', type=parse_range, default=None)
    ap.add_argument('--salida', default='resultados')
    args = ap.parse_args()

    segments = parse_log(args.log)
    if args.vacio is None and args.tiempos is None:
        list_segments(segments)
        print('\nIndica las situaciones con --vacio/--caminando/--sentado o con --tiempos')
        return

    cases = load_cases(args, segments)
    if 'vacio' not in cases:
        raise SystemExit('Falta el tramo vacio: es el que se usa para calibrar.')
    os.makedirs(args.salida, exist_ok=True)

    # --- Calibracion con una parte del tramo vacio ---
    tv, Av, _ = cases['vacio']
    ca, cb = args.calibracion if args.calibracion else (0.0, tv[-1] / 2)
    in_cal = (tv >= ca) & (tv < cb)
    p0 = baseline_profile(Av[in_cal])
    res = {}
    for key, (t, A, ks) in cases.items():
        res[key] = {'t': t, 'A': A, 'ks': ks, 'mov': motion_index(t, A), 'forma': shape_index(t, A, p0)}
    cal_mov = calibrate(res['vacio']['mov'][in_cal])
    cal_forma = calibrate(res['vacio']['forma'][in_cal])
    thr = {'mov': cal_mov['threshold'], 'forma': cal_forma['threshold']}

    # --- Tasas de deteccion ---
    lines = [f'Archivo: {os.path.basename(args.log)}',
             f'Ventana movil: {WINDOW_S:.0f} s | umbral = promedio + {K_SIGMA:.0f} desvios de la linea base',
             f'Calibracion: tramo vacio, segundos {ca:.0f} a {cb:.0f}',
             f'Umbral movimiento: {thr["mov"]:.4f} | umbral forma: {thr["forma"]:.4f}', '',
             f'{"situacion":34s} {"movimiento":>11s} {"forma":>8s} {"combinado":>10s}']
    for key, r in res.items():
        valid = ~np.isnan(r['mov']) & ~np.isnan(r['forma'])
        if key == 'vacio':
            valid &= ~in_cal  # las falsas alarmas se miden fuera de la calibracion
            label = 'Vacío (fuera de calibración) = falsas alarmas'
        else:
            label = NAMES.get(key, key)
        dm = r['mov'][valid] > thr['mov']
        df = r['forma'][valid] > thr['forma']
        r['rates'] = (detection_rate(dm), detection_rate(df), detection_rate(dm | df))
        lines.append(f'{label:34s} {r["rates"][0] * 100:10.1f}% {r["rates"][1] * 100:7.1f}% {r["rates"][2] * 100:9.1f}%'
                     f'   ({len(r["t"])} paq, {r["t"][-1]:.0f} s)')
    report = '\n'.join(lines)
    print(report)
    with open(os.path.join(args.salida, 'resumen.txt'), 'w', encoding='utf-8') as fh:
        fh.write(report + '\n')

    out1 = plot_indicators(res, thr, (ca, cb), args.salida)
    out2 = plot_profiles(res, args.salida)
    print(f'\nGraficos guardados en {out1} y {out2}')


if __name__ == '__main__':
    main()
