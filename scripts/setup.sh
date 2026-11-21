#!/usr/bin/env bash
# Funciones compartidas por start.sh. No modifica credenciales ni carga placas.

setup_error() { echo "ERROR: $*" >&2; return 1; }
setup_step() { echo "==> $*"; }

setup_path() {
  # Homebrew puede haberse instalado sin estar en el PATH de esta terminal.
  for directory in /opt/homebrew/bin /usr/local/bin /opt/homebrew/sbin /usr/local/sbin /opt/homebrew/opt/node@24/bin /usr/local/opt/node@24/bin; do
    if [[ -d "$directory" ]]; then export PATH="$directory:$PATH"; fi
  done
}

find_python() {
  local candidate
  for candidate in python3 python3.14 python3.13 python3.12; do
    if command -v "$candidate" >/dev/null 2>&1 &&
       "$candidate" -c 'import sys; sys.exit(sys.version_info < (3, 12))' >/dev/null 2>&1; then
      presence_python=$(command -v "$candidate")
      return 0
    fi
  done
  return 1
}

node_is_ready() {
  command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 &&
    node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 20 || (major === 20 && minor >= 19) ? 0 : 1)' >/dev/null 2>&1
}

ensure_brew() {
  if command -v brew >/dev/null 2>&1; then return; fi
  command -v curl >/dev/null 2>&1 || { setup_error 'Falta curl para instalar Homebrew.'; return 1; }
  setup_step 'Instalando Homebrew desde su instalador oficial; macOS puede pedir permisos'
  local installer
  installer=$(mktemp "${TMPDIR:-/tmp}/presence-brew.XXXXXX")
  if ! curl --fail --location --show-error --silent https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh -o "$installer"; then
    rm -f "$installer"
    setup_error 'No se pudo descargar Homebrew. Revisa Internet y volve a ejecutar ./start.sh.'
    return 1
  fi
  local result=0
  /bin/bash "$installer" || result=$?
  rm -f "$installer"
  [[ "$result" == 0 ]] || { setup_error 'Homebrew no se instalo. Completa los permisos o herramientas de macOS y repeti ./start.sh.'; return 1; }
  setup_path
}

install_brew_packages() {
  ensure_brew || return 1
  brew install "$@"
}

ensure_runtime_tools() {
  setup_path
  if ! find_python; then
    setup_step 'Instalando Python'
    install_brew_packages python@3.12 || return 1
    setup_path
    find_python || { setup_error 'Python 3.12+ no esta disponible despues de instalar. Repeti ./start.sh.'; return 1; }
  fi
  command -v curl >/dev/null 2>&1 || { setup_error 'Falta curl en macOS.'; return 1; }
  if ! node_is_ready; then
    install_brew_packages node@24 || return 1
    export PATH="$(brew --prefix node@24)/bin:$PATH"
    node_is_ready || { setup_error 'No se pudo preparar Node y npm.'; return 1; }
  fi
}

prepare_dependencies() {
  [[ -f .env ]] || { setup_step 'Creando .env con valores locales'; cp .env.example .env; }
  if ! backend/.venv/bin/python -c 'import sys; sys.exit(sys.version_info < (3, 12))' >/dev/null 2>&1; then
    if [[ -e backend/.venv ]]; then
      local backup="backend/.venv.backup-$(date +%Y%m%d-%H%M%S)-$$"
      setup_step "Conservando el entorno incompatible en $backup"
      mv backend/.venv "$backup" || return 1
    fi
    setup_step 'Creando el entorno Python del backend'
    "$presence_python" -m venv backend/.venv || {
      setup_error 'No se pudo crear el entorno virtual de Python.'
      return 1
    }
  fi
  local requirements_hash packages_hash node_signature
  requirements_hash=$(backend/.venv/bin/python -c 'import hashlib; print(hashlib.sha256(open("backend/requirements.txt", "rb").read()).hexdigest())')
  if [[ ! -f backend/.venv/requirements.sha256 ]] ||
     [[ "$(cat backend/.venv/requirements.sha256)" != "$requirements_hash" ]] ||
     ! backend/.venv/bin/python -c 'import fastapi, uvicorn, pydantic_settings, aiosqlite, numpy, paho.mqtt.client' >/dev/null 2>&1; then
    setup_step 'Instalando dependencias del backend'
    backend/.venv/bin/python -m pip install --disable-pip-version-check -r backend/requirements.txt || { setup_error 'Fallo pip. Revisa Internet y repeti ./start.sh.'; return 1; }
    printf '%s\n' "$requirements_hash" > backend/.venv/requirements.sha256
  fi
  packages_hash=$(backend/.venv/bin/python -c 'import hashlib; print(hashlib.sha256(open("frontend/package-lock.json", "rb").read()).hexdigest())')
  node_signature=$(node -p 'process.platform + "/" + process.arch + "/" + process.versions.node.split(".")[0]')
  if [[ ! -f frontend/node_modules/package-lock.sha256 ]] ||
     [[ "$(cat frontend/node_modules/package-lock.sha256)" != "$packages_hash/$node_signature" ]] ||
     [[ ! -f frontend/node_modules/vite/bin/vite.js || ! -f frontend/node_modules/typescript/bin/tsc ]]; then
    setup_step 'Instalando dependencias del frontend'
    (cd frontend && npm ci --no-audit --no-fund) || { setup_error 'Fallo npm ci. Revisa Internet y repeti ./start.sh.'; return 1; }
    printf '%s\n' "$packages_hash/$node_signature" > frontend/node_modules/package-lock.sha256
  fi
}
