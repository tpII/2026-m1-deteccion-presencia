#!/usr/bin/env bash
# ==============================================================================
# Script de inicio rápido en 1 comando (Modo Desarrollo Local)
# Levanta el Backend FastAPI y el Frontend React simultáneamente
# ==============================================================================

set -e

# Salir limpiamente y matar procesos hijos al presionar Ctrl+C
trap 'echo -e "\nDeteniendo servicios..."; kill $(jobs -p) 2>/dev/null; exit 0' SIGINT SIGTERM EXIT

echo "=================================================="
echo "Iniciando Sistema de Detección de Presencia"
echo "=================================================="

# 1. Iniciar Backend
echo "[1/2] Iniciando Backend FastAPI en http://localhost:8000..."
(cd backend && source .venv/bin/activate && uvicorn app.main:app --host 127.0.0.1 --port 8000) &

# Esperar 2 segundos para dar tiempo al arranque del backend
sleep 2

# 2. Iniciar Frontend
echo "[2/2] Iniciando Frontend React en http://localhost:5173..."
(cd frontend && npm run dev) &

echo "=================================================="
echo "✔ Sistema listo:"
echo "  - Dashboard Web: http://localhost:5173"
echo "  - API Swagger:   http://localhost:8000/docs"
echo "Presione Ctrl+C para detener ambos servicios."
echo "=================================================="

wait
