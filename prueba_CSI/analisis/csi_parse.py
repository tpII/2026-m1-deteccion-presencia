"""
Lectura de los .log del monitor de PlatformIO con lineas CSI_DATA.

- Separa la grabacion en tramos segun los mensajes "# Lineas CSV activadas/desactivadas".
- Convierte cada paquete en amplitudes por subportadora (solo subportadoras validas).

Formato de la linea (firmware csi_router):
  HH:MM:SS.mmm > CSI_DATA,seq,mac,rssi,rate,sig_mode,mcs,cwb,smoothing,not_sounding,aggregation,
                 stbc,fec_coding,sgi,noise_floor,ampdu_cnt,channel,secondary_channel,
                 local_timestamp,ant,sig_len,rx_state,len,first_word_invalid,"[imag,real,...]"
"""
import csv
import re
from io import StringIO

import numpy as np

COLUMNS = ['type', 'seq', 'mac', 'rssi', 'rate', 'sig_mode', 'mcs', 'cwb', 'smoothing', 'not_sounding',
           'aggregation', 'stbc', 'fec_coding', 'sgi', 'noise_floor', 'ampdu_cnt', 'channel',
           'secondary_channel', 'local_timestamp', 'ant', 'sig_len', 'rx_state', 'len',
           'first_word_invalid', 'data']

# Indices de subportadora dentro de un bloque de 64 (canal de 20 MHz, sin canal secundario):
# posiciones 0..31 -> k = 0..31 ; posiciones 32..63 -> k = -32..-1
_K = np.array(list(range(0, 32)) + list(range(-32, 0)))


def valid_positions(field):
    """Posiciones (0..63) de las subportadoras utiles del bloque.

    LLTF   (802.11a/g): k = -26..26 sin 0
    HT-LTF (802.11n)  : k = -28..28 sin 0
    Se descarta ademas k = 1 (junto con k = 0 forman los 4 bytes invalidos del ESP32).
    """
    limit = 26 if field == 'LLTF' else 28
    mask = (np.abs(_K) <= limit) & (_K != 0) & (_K != 1)
    pos = np.where(mask)[0]
    # ordenar por k (de -limit a +limit) para que los graficos sigan la frecuencia
    return pos[np.argsort(_K[pos])], np.sort(_K[mask])


def parse_log(path):
    """Devuelve una lista de tramos: [{'start','end','packets':[dict,...]}]."""
    segments, current = [], None
    line_re = re.compile(r'^(\d\d:\d\d:\d\d\.\d+) > (.*)$')
    with open(path, 'r', encoding='utf-8', errors='replace') as fh:
        for raw in fh:
            m = line_re.match(raw.rstrip('\r\n'))
            if not m:
                continue
            pc_time, msg = m.group(1), m.group(2)
            if msg.startswith('# Lineas CSV activadas'):
                current = {'start': pc_time, 'end': None, 'packets': []}
                segments.append(current)
                continue
            if msg.startswith('# Lineas CSV desactivadas'):
                if current is not None:
                    current['end'] = pc_time
                current = None
                continue
            if not msg.startswith('CSI_DATA') or current is None:
                continue
            try:
                fields = next(csv.reader(StringIO(msg)))
            except (csv.Error, StopIteration):
                continue
            if len(fields) != len(COLUMNS):
                continue  # linea cortada
            rec = dict(zip(COLUMNS, fields))
            data_txt = rec['data'].strip('[]').replace(',', ' ').split()
            try:
                buf = np.array([int(x) for x in data_txt], dtype=np.int16)
                n = int(rec['len'])
            except ValueError:
                continue
            if len(buf) != n:
                continue  # paquete incompleto
            current['packets'].append({
                'pc_time': pc_time,
                't_us': int(rec['local_timestamp']),
                'rssi': int(rec['rssi']),
                'sig_mode': int(rec['sig_mode']),
                'len': n,
                'buf': buf,
            })
    return segments


def amplitudes(packets, field='HT-LTF'):
    """Matriz (paquetes x subportadoras validas) con la amplitud |H(k)| y el tiempo en segundos."""
    offset = 0 if field == 'LLTF' else 128  # LLTF ocupa los bytes 0..127, HT-LTF los 128..255
    pos, ks = valid_positions(field)
    rows, t = [], []
    for p in packets:
        if p['len'] < offset + 128:
            continue  # paquete legacy sin HT-LTF
        block = p['buf'][offset:offset + 128].astype(float)
        imag, real = block[0::2], block[1::2]
        amp = np.hypot(real, imag)[pos]
        rows.append(amp)
        t.append(p['t_us'] / 1e6)
    t = np.array(t)
    return (t - t[0] if len(t) else t), np.array(rows), ks
