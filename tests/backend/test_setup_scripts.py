"""Ejercita la preparación sin instalar programas ni paquetes en el equipo."""

import json
import os
from pathlib import Path
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def setup_project(tmp_path):
    project = tmp_path / 'proyecto con espacios'
    (project / 'backend').mkdir(parents=True)
    (project / 'frontend').mkdir()
    (project / 'backend/requirements.txt').write_text('fastapi>=0.115\n')
    (project / 'frontend/package-lock.json').write_text('{}')
    (project / '.env.example').write_text('MQTT_HOST=localhost\n')
    commands = project / 'tools'
    commands.mkdir()
    log = project / 'calls.jsonl'
    python = commands / 'python-test'
    python.write_text(f'#!{Path(sys.executable).resolve()}\n' + r'''
import json, os, pathlib, sys
args = sys.argv[1:]
with open(os.environ['SETUP_TEST_LOG'], 'a') as out:
    out.write(json.dumps(['python', *args]) + '\n')
if args[:2] == ['-m', 'venv']:
    target = pathlib.Path(args[2]) / 'bin/python'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.symlink_to(pathlib.Path(__file__).resolve())
elif args[:2] == ['-m', 'pip']:
    sys.exit(int(os.environ.get('SETUP_PIP_EXIT', '0')))
elif args[:1] == ['-c']:
    if 'hashlib' in args[1]:
        exec(args[1])
    elif 'import fastapi' in args[1]:
        sys.exit(int(os.environ.get('SETUP_IMPORT_EXIT', '0')))
''')
    python.chmod(0o755)
    npm = commands / 'npm'
    npm.write_text(f'#!{Path(sys.executable).resolve()}\n' + r'''
import json, os, pathlib, sys
with open(os.environ['SETUP_TEST_LOG'], 'a') as out:
    out.write(json.dumps(['npm', *sys.argv[1:]]) + '\n')
if os.environ.get('SETUP_NPM_EXIT'):
    sys.exit(int(os.environ['SETUP_NPM_EXIT']))
for name in ['vite/bin/vite.js', 'typescript/bin/tsc']:
    p = pathlib.Path('node_modules') / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.touch()
''')
    npm.chmod(0o755)
    node = commands / 'node'
    node.write_text('#!/bin/sh\necho linux/x64/24\n')
    node.chmod(0o755)
    environment = dict(os.environ, PATH=f'{commands}:{os.environ["PATH"]}', SETUP_TEST_LOG=str(log))

    def run(**overrides):
        command = 'set -euo pipefail\nsource "$1"\npresence_python="$2"\nprepare_dependencies\n'
        return subprocess.run(['bash', '-c', command, 'setup-test', str(ROOT / 'scripts/setup.sh'), str(python)],
                              cwd=project, env=dict(environment, **overrides), text=True, capture_output=True)

    def calls():
        return [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []

    return project, run, calls


def test_fresh_setup_and_repeat_do_not_overwrite_configuration(setup_project):
    project, run, calls = setup_project
    first = run()
    assert first.returncode == 0, first.stderr
    assert (project / '.env').read_text() == 'MQTT_HOST=localhost\n'
    installs = [call for call in calls() if call[:3] == ['python', '-m', 'pip'] or call[0] == 'npm']
    assert len(installs) == 2
    assert installs[-1][1] == 'ci'
    (project / '.env').write_text('MQTT_HOST=mi-broker\n')
    assert run().returncode == 0
    assert (project / '.env').read_text() == 'MQTT_HOST=mi-broker\n'
    assert len([call for call in calls() if call[:3] == ['python', '-m', 'pip'] or call[0] == 'npm']) == 2


def test_changed_manifests_and_missing_tools_reinstall(setup_project):
    project, run, calls = setup_project
    assert run().returncode == 0
    (project / 'backend/requirements.txt').write_text('fastapi>=0.116\n')
    (project / 'frontend/package-lock.json').write_text('{"lockfileVersion":3}')
    assert run().returncode == 0
    assert len([c for c in calls() if c[:3] == ['python', '-m', 'pip']]) == 2
    assert len([c for c in calls() if c[0] == 'npm']) == 2
    (project / 'frontend/node_modules/vite/bin/vite.js').unlink()
    assert run().returncode == 0
    assert len([c for c in calls() if c[0] == 'npm']) == 3
    assert run(SETUP_IMPORT_EXIT='1').returncode == 0
    assert len([c for c in calls() if c[:3] == ['python', '-m', 'pip']]) == 3


@pytest.mark.parametrize('failure,marker', [
    ({'SETUP_PIP_EXIT': '1'}, 'backend/.venv/requirements.sha256'),
    ({'SETUP_NPM_EXIT': '1'}, 'frontend/node_modules/package-lock.sha256'),
])
def test_failed_install_is_not_marked_ready_and_can_be_retried(setup_project, failure, marker):
    project, run, _ = setup_project
    result = run(**failure)
    assert result.returncode != 0
    assert not (project / marker).exists()
    assert 'Revisa Internet' in result.stderr
    assert run().returncode == 0
    assert (project / marker).exists()


def test_incompatible_environment_is_preserved(setup_project):
    project, run, _ = setup_project
    (project / 'backend/.venv').mkdir()
    (project / 'backend/.venv/nota.txt').write_text('conservar')
    result = run()
    assert result.returncode == 0, result.stderr
    backups = list((project / 'backend').glob('.venv.backup-*'))
    assert len(backups) == 1
    assert (backups[0] / 'nota.txt').read_text() == 'conservar'


def test_start_help_does_not_install_anything():
    result = subprocess.run(['bash', str(ROOT / 'start.sh'), '--help'], text=True, capture_output=True)
    assert result.returncode == 0
    assert 'Instala lo que falte' in result.stdout
