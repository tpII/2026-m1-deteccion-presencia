"""Arranque real en una copia aislada y puertos libres; no toca el servidor del usuario."""

import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.request

import pytest
from paho.mqtt.publish import single

ROOT = Path(__file__).resolve().parents[2]
pytestmark = pytest.mark.skipif(
    os.environ.get('RUN_MQTT_INTEGRATION') != '1' or not shutil.which('mosquitto'),
    reason='Requiere RUN_MQTT_INTEGRATION=1, Node y Mosquitto locales',
)


def free_port():
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        return listener.getsockname()[1]


def test_one_command_prepares_backend_and_starts_stack_twice(tmp_path):
    api_port, web_port, broker_port = free_port(), free_port(), free_port()
    project = tmp_path / 'proyecto aislado'
    project.mkdir()
    for folder in ('scripts', 'mosquitto', 'backend/app', 'frontend/src'):
        shutil.copytree(ROOT / folder, project / folder, ignore=shutil.ignore_patterns('__pycache__'))
    for name in ('.env.example', 'backend/requirements.txt', 'frontend/package.json',
                 'frontend/package-lock.json', 'frontend/vite.config.ts', 'frontend/index.html', 'frontend/tsconfig.json'):
        shutil.copy2(ROOT / name, project / name)
    # Mantiene la lógica del script y cambia solo sus puertos para no afectar la demo abierta.
    script = (ROOT / 'start.sh').read_text().replace('8000', str(api_port)).replace('5173', str(web_port))
    (project / 'start.sh').write_text(script)
    venv = project / 'backend/.venv'
    subprocess.run([sys.executable, '-m', 'venv', str(venv)], check=True)
    # Reutiliza paquetes ya instalados, sin descargas ni mutaciones del entorno original.
    packages = subprocess.check_output([sys.executable, '-c', 'import site; print(site.getsitepackages()[0])'], text=True).strip()
    site_dir = next((venv / 'lib').glob('python*/site-packages'))
    (site_dir / 'existing-packages.pth').write_text(packages + '\n')
    node_modules = project / 'frontend/node_modules'
    node_modules.mkdir()
    for package in (ROOT / 'frontend/node_modules').iterdir():
        if package.name != 'package-lock.sha256':
            (node_modules / package.name).symlink_to(package.resolve(), target_is_directory=package.is_dir())
    lock_hash = hashlib.sha256((project / 'frontend/package-lock.json').read_bytes()).hexdigest()
    node_signature = subprocess.check_output(['node', '-p', 'process.platform + "/" + process.arch + "/" + process.versions.node.split(".")[0]'], text=True).strip()
    (node_modules / 'package-lock.sha256').write_text(f'{lock_hash}/{node_signature}\n')
    environment = dict(os.environ, MQTT_HOST='127.0.0.1', MQTT_PORT=str(broker_port),
                       MQTT_CLIENT_ID=f'bootstrap-{api_port}', PIP_NO_INDEX='1', PRESENCE_OPEN_BROWSER='0',
                       DATABASE_URL=f'sqlite+aiosqlite:///{project / "backend/test.db"}')

    def get(path):
        with urllib.request.urlopen(f'http://127.0.0.1:{api_port}{path}', timeout=2) as response:
            return json.load(response)

    for run in (1, 2):
        log_path = tmp_path / f'run-{run}.log'
        with log_path.open('w') as output:
            process = subprocess.Popen(['bash', 'start.sh'], cwd=project, env=environment, stdout=output, stderr=subprocess.STDOUT)
            try:
                deadline = time.monotonic() + 35
                while time.monotonic() < deadline:
                    assert process.poll() is None, log_path.read_text()
                    try:
                        health = get('/api/v1/health')
                        with urllib.request.urlopen(f'http://127.0.0.1:{web_port}', timeout=1) as response:
                            if health['mqtt_connected'] and response.status == 200:
                                break
                    except OSError:
                        pass
                    time.sleep(0.2)
                else:
                    pytest.fail(log_path.read_text())
                single('sensores/pir/presencia', json.dumps({'case_id': 'pir', 'presence': True, 'raw_value': 1}),
                       hostname='127.0.0.1', port=broker_port)
                deadline = time.monotonic() + 5
                while time.monotonic() < deadline:
                    statuses = get('/api/v1/telemetry/status')
                    if next(s for s in statuses if s['case_id'] == 'pir')['total_samples']:
                        break
                    time.sleep(0.1)
                else:
                    pytest.fail('No llegó la publicación MQTT')
                assert len(get('/api/v1/telemetry/pir/history')) == run
                assert (project / '.env').exists()
                assert (venv / 'requirements.sha256').exists()
                assert (project / f'.runtime/mosquitto-{broker_port}.conf').exists()
            finally:
                process.send_signal(signal.SIGTERM)
                process.wait(timeout=15)
        if run == 1:
            assert 'Instalando dependencias del backend' in log_path.read_text()
        else:
            assert 'Instalando dependencias' not in log_path.read_text()
