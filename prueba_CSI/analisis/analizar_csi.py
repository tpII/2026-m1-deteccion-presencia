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

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

from csi_parse import parse_log, amplitudes
from csi_detect import (WINDOW_S, K_SIGMA, motion_index, baseline_profile, shape_index, profile,
                        calibrate, detection_rate)

INK, INK2, GRID = '#0b0b0b', '#52514e', '#e4e3df'
SERIES = '#2a78d6'
CALIB_BAND = '#efeeea'
NAMES = {'vacio': 'Vacío', 'caminando': 'Caminando', 'sentado': 'Sentado quieto'}


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


def style_axes(ax):
    for side in ('top', 'right'):
        ax.spines[side].set_visible(False)
    for side in ('left', 'bottom'):
        ax.spines[side].set_color(GRID)
    ax.tick_params(colors=INK2, labelsize=9)
    ax.grid(axis='y', color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)


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

    keys = list(res.keys())
    widths = [res[k]['t'][-1] for k in keys]

    # --- Figura 1: los dos indicadores ---
    fig, axes = plt.subplots(2, len(keys), figsize=(11, 6.2), sharey='row', squeeze=False,
                             gridspec_kw={'width_ratios': widths, 'wspace': 0.06, 'hspace': 0.55})
    rows = [('mov', 'indicador de movimiento'), ('forma', 'indicador de forma')]
    for r_i, (feat, ylabel) in enumerate(rows):
        ymax = max(np.nanmax(res[k][feat]) for k in keys) * 1.1
        for c_i, key in enumerate(keys):
            ax, r = axes[r_i][c_i], res[key]
            style_axes(ax)
            if key == 'vacio':
                ax.axvspan(ca, cb, color=CALIB_BAND, zorder=0)
                if r_i == 0:
                    ax.text((ca + cb) / 2, ymax * 0.95, 'calibración', ha='center', va='top', color=INK2, fontsize=9)
            ax.plot(r['t'], r[feat], color=SERIES, linewidth=1.5)
            ax.axhline(thr[feat], color=INK2, linewidth=1.2, linestyle=(0, (4, 3)))
            ax.set_xlim(0, r['t'][-1])
            ax.set_ylim(0, ymax)
            rate = r['rates'][0 if feat == 'mov' else 1]
            what = 'falsas alarmas' if key == 'vacio' else 'detección'
            ax.set_title(f'{NAMES.get(key, key)} · {what} {rate * 100:.0f} %', color=INK, fontsize=10, loc='left')
            if r_i == 1:
                ax.set_xlabel('tiempo (s)', color=INK2, fontsize=9)
        axes[r_i][0].set_ylabel(ylabel, color=INK2, fontsize=9)
        last = axes[r_i][-1]
        last.text(last.get_xlim()[1], thr[feat] + ymax * 0.02, f'umbral {thr[feat]:.3f}', va='bottom', ha='right',
                  color=INK2, fontsize=9, bbox={'facecolor': 'white', 'edgecolor': 'none', 'pad': 1})
    fig.suptitle('Movimiento detecta a quien camina; forma detecta también a quien está quieto',
                 x=0.06, ha='left', color=INK, fontsize=13, fontweight='bold')
    fig.text(0.06, 0.925, f'Ventanas de {WINDOW_S:.0f} s. Umbrales calibrados con el tramo sombreado de la '
             'habitación vacía. Hay presencia si cualquiera de los dos supera su umbral.', color=INK2, fontsize=9)
    fig.subplots_adjust(top=0.84, bottom=0.08, left=0.07, right=0.98)
    out1 = os.path.join(args.salida, 'indicadores.png')
    fig.savefig(out1, dpi=200, facecolor='white')
    plt.close(fig)

    # --- Figura 2: perfil de subportadoras ---
    rel = {k: profile(res[k]['A']) for k in keys}
    vmin, vmax = np.percentile(np.concatenate([v.ravel() for v in rel.values()]), [1, 99])
    fig, axes = plt.subplots(1, len(keys), figsize=(11, 3.8), sharey=True, squeeze=False,
                             gridspec_kw={'width_ratios': widths, 'wspace': 0.06})
    for ax, key in zip(axes[0], keys):
        r = res[key]
        mesh = ax.pcolormesh(r['t'], r['ks'], rel[key].T, cmap='Blues', vmin=vmin, vmax=vmax, shading='nearest',
                             rasterized=True)
        ax.set_title(NAMES.get(key, key), color=INK, fontsize=11, loc='left')
        ax.set_xlabel('tiempo (s)', color=INK2, fontsize=9)
        ax.tick_params(colors=INK2, labelsize=9)
        for side in ax.spines.values():
            side.set_visible(False)
    axes[0][0].set_ylabel('subportadora (índice k)', color=INK2, fontsize=9)
    fig.subplots_adjust(top=0.78, bottom=0.14, left=0.07, right=0.89)
    cax = fig.add_axes([0.905, 0.14, 0.012, 0.64])
    cb_ = fig.colorbar(mesh, cax=cax)
    cb_.set_label('amplitud relativa', color=INK2, fontsize=9)
    cb_.ax.tick_params(colors=INK2, labelsize=8)
    cb_.outline.set_visible(False)
    fig.suptitle('Con la habitación vacía la forma del canal se mantiene; con una persona cambia',
                 x=0.06, ha='left', color=INK, fontsize=13, fontweight='bold')
    fig.text(0.06, 0.885, 'Amplitud de cada subportadora del campo HT-LTF dividida por el promedio del paquete '
             '(802.11n, 20 MHz).', color=INK2, fontsize=9)
    out2 = os.path.join(args.salida, 'amplitud_subportadoras.png')
    fig.savefig(out2, dpi=200, facecolor='white')
    plt.close(fig)
    print(f'\nGraficos guardados en {out1} y {out2}')


if __name__ == '__main__':
    main()
