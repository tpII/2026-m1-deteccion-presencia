#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

mode="${1:-mqtt}"
if [[ "$mode" == "--help" || "$mode" == "-h" ]]; then
  echo "Uso: ./start.sh [mqtt]"
  echo "Instala lo que falte y levanta broker, backend y web. Ctrl+C detiene sus procesos."
  echo "macOS: Homebrew. Linux: apt para herramientas y Node oficial local."
  echo "La primera instalacion necesita Internet y puede pedir permisos de administrador."
  echo "Las placas se configuran y programan por separado; no se generan lecturas ficticias."
  exit 0
fi
if [[ $# -gt 1 || "$mode" != "mqtt" ]]; then
  echo "Uso: ./start.sh [mqtt]" >&2
  exit 1
fi
source scripts/setup.sh
ensure_runtime_tools

pids=()
cleanup() {
  trap - EXIT INT TERM
  echo "Deteniendo los procesos iniciados por este script..."
  if [[ ${#pids[@]} -gt 0 ]]; then
    for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
    for pid in "${pids[@]}"; do wait "$pid" 2>/dev/null || true; done
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

port_is_open() {
  "$presence_python" - "$1" "$2" <<'PYTHON'
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

prepare_dependencies

export DATA_SOURCE=mqtt
read -r broker_host broker_port < <(cd backend && .venv/bin/python -c 'from app.config import settings; print(settings.MQTT_HOST, settings.MQTT_PORT)')
if ! port_is_open "$broker_host" "$broker_port"; then
  if [[ "$broker_host" != "localhost" && "$broker_host" != "127.0.0.1" ]]; then
    echo "El broker configurado en $broker_host:$broker_port no responde. Inicialo primero." >&2
    exit 1
  fi
  if ! command -v mosquitto >/dev/null 2>&1; then
    setup_step 'Instalando Mosquitto'
    if [[ "$(uname -s)" == Darwin ]]; then
      install_system_packages mosquitto
    else
      install_system_packages mosquitto mosquitto-clients
    fi
    setup_path
  fi
  if port_is_open "$broker_host" "$broker_port"; then
    echo 'Reutilizando el broker iniciado durante la instalacion. Verifica su acceso desde la red local.'
  else
    broker_config=mosquitto/mosquitto.conf
    if [[ "$broker_port" != 1883 ]]; then
      mkdir -p .runtime
      broker_config=".runtime/mosquitto-$broker_port.conf"
      printf 'listener %s 0.0.0.0\nallow_anonymous true\npersistence false\nlog_dest stdout\n' "$broker_port" > "$broker_config"
    fi
    mosquitto -c "$broker_config" &
    pids+=("$!")
    broker_ready=false
    for attempt in {1..15}; do
      if port_is_open "$broker_host" "$broker_port"; then broker_ready=true; break; fi
      sleep 1
    done
    if [[ "$broker_ready" != "true" ]]; then echo "Mosquitto no pudo iniciar." >&2; exit 1; fi
  fi
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
frontend_ready=false
for attempt in {1..20}; do
  if curl -fsS --max-time 1 http://127.0.0.1:5173/ >/dev/null 2>&1; then frontend_ready=true; break; fi
  kill -0 "${pids[${#pids[@]}-1]}" 2>/dev/null || { echo 'El frontend no pudo iniciar.' >&2; exit 1; }
  sleep 1
done
if [[ "$frontend_ready" != true ]]; then echo 'La web no respondio a tiempo.' >&2; exit 1; fi
echo "Modo: $mode"
echo "Dashboard: http://localhost:5173"
echo "API: http://localhost:8000/docs"
echo "Ctrl+C detiene los procesos iniciados por este script."
if [[ "${PRESENCE_OPEN_BROWSER:-1}" != 0 ]]; then
  if command -v open >/dev/null 2>&1 && [[ "$(uname -s)" == Darwin ]]; then
    open http://localhost:5173 >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open http://localhost:5173 >/dev/null 2>&1 || true
  fi
fi
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
