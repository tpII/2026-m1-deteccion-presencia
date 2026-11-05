"""Figuras de indicadores y subportadoras del análisis de grabaciones CSI."""

import os

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

from csi_detect import WINDOW_S, profile

INK, INK2, GRID = '#0b0b0b', '#52514e', '#e4e3df'
SERIES = '#2a78d6'
CALIB_BAND = '#efeeea'
NAMES = {'vacio': 'Vacío', 'caminando': 'Caminando', 'sentado': 'Sentado quieto'}


def style_axes(ax):
    for side in ('top', 'right'):
        ax.spines[side].set_visible(False)
    for side in ('left', 'bottom'):
        ax.spines[side].set_color(GRID)
    ax.tick_params(colors=INK2, labelsize=9)
    ax.grid(axis='y', color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)


def plot_indicators(res, thr, calibration, output_dir):
    ca, cb = calibration
    keys = list(res)
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
    out1 = os.path.join(output_dir, 'indicadores.png')
    fig.savefig(out1, dpi=200, facecolor='white')
    plt.close(fig)

    return out1


def plot_profiles(res, output_dir):
    keys = list(res)
    widths = [res[k]['t'][-1] for k in keys]

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
    out2 = os.path.join(output_dir, 'amplitud_subportadoras.png')
    fig.savefig(out2, dpi=200, facecolor='white')
    plt.close(fig)
    return out2
