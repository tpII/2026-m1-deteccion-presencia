#!/usr/bin/env python3
"""
Script de simulación de microcontroladores ESP32 publicando telemetría MQTT real.
Permite validar la ingesta MQTT del backend sin necesidad de hardware físico encendido.

Uso:
    python scripts/mqtt_test_publisher.py --host localhost --port 1883 --case all
"""

import argparse
import json
import random
import time
import sys
import numpy as np

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("Error: 'paho-mqtt' no está instalado. Ejecute: pip install paho-mqtt")
    sys.exit(1)


def parse_args():
    parser = argparse.ArgumentParser(description="Simulador de Hardware ESP32 para MQTT")
    parser.add_argument("--host", default="localhost", help="Dirección del broker MQTT (default: localhost)")
    parser.add_argument("--port", type=int, default=1883, help="Puerto del broker MQTT (default: 1883)")
    parser.add_argument(
        "--case",
        choices=["pir", "csi_router", "csi_dedicated", "all"],
        default="all",
        help="Caso a publicar (default: all)",
    )
    parser.add_argument("--interval", type=float, default=0.2, help="Intervalo de publicación en seg (default: 0.2s)")
    return parser.parse_args()


def main():
    args = parse_args()
    print("==================================================")
    print("ESP32 MQTT Hardware Test Publisher")
    print(f"Broker: {args.host}:{args.port}")
    print(f"Caso seleccionado: {args.case.upper()}")
    print(f"Intervalo: {args.interval}s")
    print("Presione Ctrl+C para detener.")
    print("==================================================")

    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="esp32_hardware_simulator")
    except AttributeError:
        client = mqtt.Client(client_id="esp32_hardware_simulator")

    try:
        client.connect(args.host, args.port, keepalive=60)
        client.loop_start()
    except Exception as e:
        print(f"Error conectando al broker MQTT: {e}")
        print("Verifique que Eclipse Mosquitto esté corriendo en el puerto indicado.")
        sys.exit(1)

    t = 0.0
    pir_state = False
    pir_timer = 0

    try:
        while True:
            now_iso = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
            t += args.interval

            # 1. PIR Simulator
            if args.case in ("pir", "all"):
                pir_timer -= 1
                if pir_timer <= 0:
                    pir_state = not pir_state
                    pir_timer = int(random.uniform(3.0, 7.0) / args.interval)

                pir_payload = {
                    "timestamp": now_iso,
                    "case_id": "pir",
                    "source": "esp32_pir_node_01",
                    "presence": pir_state,
                    "raw_value": 1.0 if pir_state else 0.0,
                    "latency_ms": round(random.uniform(130.0, 160.0), 1),
                    "ground_truth": pir_state,
                }
                client.publish("presence/pir/telemetry", json.dumps(pir_payload))

            # 2. CSI Router Simulator
            if args.case in ("csi_router", "all"):
                # Perturbación sinusoidal periódica simulando persona caminando
                presence_active = (int(t / 8.0) % 2) == 1
                base = 22.0 + np.random.normal(0, 0.6)
                if presence_active:
                    base += np.sin(2.0 * np.pi * 0.4 * t) * 3.5 + np.random.normal(0, 1.2)

                router_payload = {
                    "timestamp": now_iso,
                    "case_id": "csi_router",
                    "source": "esp32_csi_sta_node",
                    "amplitudes": [round(float(base), 3)],
                    "latency_ms": round(random.uniform(310.0, 340.0), 1),
                    "ground_truth": presence_active,
                }
                client.publish("presence/csi/router/raw", json.dumps(router_payload))

            # 3. CSI Dedicated Simulator
            if args.case in ("csi_dedicated", "all"):
                presence_active = (int((t + 3.0) / 9.0) % 2) == 1
                base = 35.0 + np.random.normal(0, 0.4)
                if presence_active:
                    base += np.sin(2.0 * np.pi * 0.5 * t) * 4.2 + np.random.normal(0, 1.5)

                dedicated_payload = {
                    "timestamp": now_iso,
                    "case_id": "csi_dedicated",
                    "source": "esp32_dedicated_pair",
                    "amplitudes": [round(float(base), 3)],
                    "latency_ms": round(random.uniform(390.0, 420.0), 1),
                    "ground_truth": presence_active,
                }
                client.publish("presence/csi/dedicated/raw", json.dumps(dedicated_payload))

            time.sleep(args.interval)

    except KeyboardInterrupt:
        print("\nDeteniendo simulador ESP32...")
    finally:
        client.loop_stop()
        client.disconnect()
        print("Desconectado.")


if __name__ == "__main__":
    main()
