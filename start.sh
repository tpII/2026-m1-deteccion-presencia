#!/usr/bin/env bash
# Desarrollo local: Mosquitto, FastAPI y web para recibir telemetria del hardware.
set -euo pipefail
cd "$(dirname "$0")"

mode="${1:-mqtt}"
if [[ "$mode" == "--help" || "$mode" == "-h" ]]; then
  echo "Uso: ./start.sh [mqtt]"
  echo "Recibe lecturas de los ESP32 por MQTT; requiere hardware para obtener datos."
  exit 0
fi
if [[ $# -gt 1 || "$mode" != "mqtt" ]]; then
  echo "Uso: ./start.sh [mqtt]" >&2
  exit 1
fi
for executable in node curl; do
  command -v "$executable" >/dev/null || { echo "Falta instalar $executable." >&2; exit 1; }
done
if [[ ! -x backend/.venv/bin/python || ! -f frontend/node_modules/vite/bin/vite.js ]]; then
  echo "Instala primero las dependencias siguiendo README.md, seccion 2." >&2
  exit 1
fi

pids=()
cleanup() {
  trap - EXIT INT TERM
  echo "Deteniendo los procesos iniciados por este script..."
  # Bash 3.2 de macOS considera una expansion de array vacio como no definida.
  if [[ ${#pids[@]} -gt 0 ]]; then
    for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
    for pid in "${pids[@]}"; do wait "$pid" 2>/dev/null || true; done
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

port_is_open() {
  backend/.venv/bin/python - "$1" "$2" <<'PYTHON'
import socket
import sys
try:
    with socket.create_connection((sys.argv[1], int(sys.argv[2])), timeout=0.5):
        pass
except OSError:
    sys.exit(1)
PYTHON
}

for port in 8000 5173; do
  if port_is_open 127.0.0.1 "$port"; then
    echo "El puerto $port esta ocupado. Detene la instancia anterior antes de iniciar otra." >&2
    exit 1
  fi
done

export DATA_SOURCE=mqtt
read -r broker_host broker_port < <(cd backend && .venv/bin/python -c 'from app.core.config import settings; print(settings.MQTT_HOST, settings.MQTT_PORT)')
if ! port_is_open "$broker_host" "$broker_port"; then
  if [[ "$broker_host" != "localhost" && "$broker_host" != "127.0.0.1" ]] || [[ "$broker_port" != "1883" ]]; then
    echo "El broker configurado en $broker_host:$broker_port no responde. Inicialo primero." >&2
    exit 1
  fi
  command -v mosquitto >/dev/null || { echo "Falta Mosquitto. Instala el broker siguiendo README.md." >&2; exit 1; }
  mosquitto -c infrastructure/mosquitto/mosquitto.local.conf &
  pids+=("$!")
  broker_ready=false
  for attempt in {1..15}; do
    if port_is_open "$broker_host" "$broker_port"; then broker_ready=true; break; fi
    sleep 1
  done
  if [[ "$broker_ready" != "true" ]]; then echo "Mosquitto no pudo iniciar." >&2; exit 1; fi
else
  echo "Reutilizando broker en $broker_host:$broker_port. No se detendra al salir."
fi

(cd backend && exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload) &
pids+=("$!")
backend_ready=false
for attempt in {1..20}; do
  if curl -fsS --max-time 1 http://127.0.0.1:8000/api/v1/health >/dev/null 2>&1; then backend_ready=true; break; fi
  kill -0 "${pids[${#pids[@]}-1]}" 2>/dev/null || { echo "El backend no pudo iniciar." >&2; exit 1; }
  sleep 1
done
if [[ "$backend_ready" != "true" ]]; then echo "El backend no respondio a tiempo." >&2; exit 1; fi

# Comprobar MQTT, no solamente que el puerto TCP este abierto.
(cd backend && .venv/bin/python - <<'PYTHON'
import json
import time
import urllib.request
for attempt in range(20):
    with urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=2) as response:
        if json.load(response)['mqtt_connected']:
            break
    time.sleep(0.5)
else:
    raise SystemExit('El backend no pudo suscribirse al broker MQTT. Revisa la configuracion y los logs.')
PYTHON
)

(cd frontend && exec node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort) &
pids+=("$!")
echo "Modo: $mode"
echo "Dashboard: http://localhost:5173"
echo "API: http://localhost:8000/docs"
echo "Ctrl+C detiene los procesos iniciados por este script."
# Detectar caidas y apagar los otros procesos en vez de dejar una prueba parcial.
while true; do
  for pid in "${pids[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      result=0
      wait "$pid" || result=$?
      echo "Un proceso de la prueba se detuvo (codigo $result)." >&2
      exit 1
    fi
  done
  sleep 1
done
