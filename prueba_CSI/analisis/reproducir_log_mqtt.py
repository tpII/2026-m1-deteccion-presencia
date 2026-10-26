"""
Reproduce una grabacion CSI (.log del monitor serie) por MQTT, como si la enviara el ESP32.

Sirve para probar el backend y la web sin la placa: publica en presence/csi/router/raw las
mismas 55 amplitudes por paquete que calcula el firmware (firmware/csi_router), respetando
los tiempos originales de la grabacion.

Uso:
  python reproducir_log_mqtt.py archivo.log                       # todo el tramo mas largo
  python reproducir_log_mqtt.py archivo.log --desde 10 --hasta 300
  python reproducir_log_mqtt.py archivo.log --host 192.168.0.100 --repetir

Requiere: pip install numpy paho-mqtt (y Mosquitto + backend en marcha).
"""
import argparse
import json
import time

import numpy as np
import paho.mqtt.client as mqtt

from csi_parse import parse_log, amplitudes

TOPIC = 'presence/csi/router/raw'


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('log')
    ap.add_argument('--tramo', type=int, default=None, help='numero de tramo (por defecto, el mas largo)')
    ap.add_argument('--desde', type=float, default=0.0, help='segundo inicial dentro del tramo')
    ap.add_argument('--hasta', type=float, default=None, help='segundo final dentro del tramo')
    ap.add_argument('--host', default='localhost')
    ap.add_argument('--port', type=int, default=1883)
    ap.add_argument('--repetir', action='store_true', help='volver a empezar al terminar')
    args = ap.parse_args()

    segments = parse_log(args.log)
    segment = segments[args.tramo] if args.tramo is not None else max(segments, key=lambda s: len(s['packets']))
    t, A, _ = amplitudes(segment['packets'])
    end = args.hasta if args.hasta is not None else t[-1] + 1
    keep = (t >= args.desde) & (t < end)
    t, A = t[keep] - args.desde, A[keep]
    print(f'{len(t)} paquetes, {t[-1]:.0f} s, publicando en {args.host}:{args.port} {TOPIC}')

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id='reproductor-csi')
    client.connect(args.host, args.port)
    client.loop_start()
    try:
        while True:
            start = time.monotonic()
            for i, (ti, amps) in enumerate(zip(t, A)):
                delay = start + ti - time.monotonic()
                if delay > 0:
                    time.sleep(delay)
                payload = {'case_id': 'csi_router', 'source': 'reproductor', 'amplitudes': np.round(amps, 1).tolist()}
                client.publish(TOPIC, json.dumps(payload))
                if i % 100 == 0:
                    print(f'  segundo {ti:6.1f} de {t[-1]:.0f}')
            if not args.repetir:
                break
    except KeyboardInterrupt:
        pass
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == '__main__':
    main()
