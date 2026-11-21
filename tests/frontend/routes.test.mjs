import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement, StrictMode, App, FakeSocket, mount, json, inputValue } from './reactHarness.mjs';

test('la página CSI muestra los indicadores, sus umbrales y el estado de calibración', async () => {
  window.history.replaceState(null, '', '/case/csi_router');
  const posts = [];
  globalThis.fetch = async (url, options) => {
    if (options?.method === 'POST') {
      posts.push(url);
      assert.deepEqual(JSON.parse(options.body), { environment: 'Casa A' });
      return json({ state: 'esperando', message: 'Salí de la habitación', progress: 0, seconds_remaining: 10 });
    }
    return url.endsWith('/trials') ? json([]) : url.endsWith('/health') ? json({ data_source: 'mqtt' }) : json({ total_tests: 0 });
  };
  await mount(createElement(App));
  assert.equal(document.querySelector('.live-trial fieldset'), null);
  await act(async () => {
    const socket = FakeSocket.instances.at(-1);
    socket.open();
    socket.receive({
      type: 'telemetry_batch',
      data: {
        statuses: [{ case_id: 'csi_router', is_connected: true, can_record_trial: true,
          sample_key: 'a'.repeat(32), presence: true, current_latency_ms: 10 }],
        cases: {
          csi_router: {
            case_id: 'csi_router', presence: true,
            raw_points: [{ timestamp: 1000, value: 20 }, { timestamp: 1500, value: 23 }],
            movement_points: [{ timestamp: 1000, value: 0.01 }, { timestamp: 1500, value: 0.04 }],
            shape_points: [{ timestamp: 1000, value: 0.05 }, { timestamp: 1500, value: 0.2 }],
            features: { movement_index: 0.04, movement_threshold: 0.0165, shape_index: 0.2, shape_threshold: 0.0474, detection_ratio: 4.219 },
            calibration: { state: 'calibrado', message: 'Calibrado con 300 paquetes de la habitación vacía.', progress: 1, seconds_remaining: 0 },
          },
        },
      },
    });
  });
  assert.equal(document.querySelectorAll('[_echarts_instance_] svg').length, 3);
  assert.match(document.body.textContent, /umbral 0\.017/);
  assert.match(document.body.textContent, /0\.0474/);
  assert.match(document.body.textContent, /4\.22/);
  assert.match(document.body.textContent, /Calibrado con 300 paquetes/);
  const live = document.querySelector('.calibration-panel + .live-trial');
  assert.match(live.querySelector('.live-trial-reading').textContent, /PRESENCIA/);
  assert.match(live.querySelector('fieldset').textContent, /Presencia cerca del router Wi-Fi/);
  const button = [...document.querySelectorAll('button')].find((element) => element.textContent.includes('Recalibrar'));
  assert.equal(button.disabled, true);
  await act(async () => inputValue(document.querySelector('.trial-environment input'), 'Casa A'));
  await act(async () => button.click());
  assert.deepEqual(posts, ['http://localhost:8000/api/v1/csi/csi_router/calibration']);
});

test('el PIR registra una marca en la línea de tiempo desde la telemetría', async () => {
  window.history.replaceState(null, '', '/case/pir');
  let savedTrial;
  globalThis.fetch = async (url, options) => {
    if (options?.method === 'POST') {
      assert.ok(url.endsWith('/observations'));
      const observation = JSON.parse(options.body);
      const { observed_at: observedAt, ...fields } = observation;
      assert.match(observedAt, /\.\d{3}Z$/);
      assert.deepEqual(fields, { case_id: 'pir', scenario: 'present', environment: 'Casa A' });
      savedTrial = { ...observation, id: 1, received_at: observedAt };
      return json(savedTrial);
    }
    if (url.includes('/observations/pir?')) return json({
      marks: [savedTrial],
      samples: [{
        id: 9, timestamp: savedTrial.observed_at, observation_id: 1, scenario: 'present',
        detected_presence: false, result: 'false_negative',
      }],
      calibrations: [{
        id: 5, started_at: savedTrial.observed_at, finished_at: savedTrial.observed_at,
        outcome: 'exitosa', sample_count: 50, evaluated: 1, false_positives: 0, false_negatives: 1,
      }],
    });
    if (url.endsWith('/trials')) return json([]);
    return json({ total_tests: 0 });
  };
  await mount(createElement(App));
  await act(async () => {
    const socket = FakeSocket.instances.at(-1);
    socket.open();
    socket.receive({ type: 'telemetry_batch', data: {
      statuses: [{ case_id: 'pir', is_connected: true, can_record_trial: true,
        sample_key: 'b'.repeat(32), presence: false }],
      cases: {},
    } });
    inputValue(document.querySelector('.trial-environment input'), 'Casa A');
  });
  const telemetry = document.querySelector('.live-trial').closest('section');
  assert.match(telemetry.querySelector('h2').textContent, /Telemetría en vivo/);
  assert.match(telemetry.querySelector('.live-trial-reading').textContent, /SIN MOVIMIENTO/);
  await act(async () => telemetry.querySelector('fieldset button').click());
  assert.match(telemetry.querySelector('.form-notice').textContent, /Marca #1 guardada/);
  await act(async () => {
    const details = telemetry.querySelector('details');
    details.open = true;
    details.dispatchEvent(new window.Event('toggle'));
  });
  assert.match(telemetry.querySelector('tbody').textContent, /#1.*Presencia/);
  assert.match(telemetry.querySelector('details').textContent, /Falso negativo/);
  assert.match(telemetry.querySelector('details').textContent, /#5.*Exitosa/);
});

for (const [path, heading] of [
  ['/', 'Detección de Presencia'],
  ['/case/pir', 'Sensor Infrarrojo'],
  ['/case/csi_router', 'Router Wi-Fi'],
  ['/case/combined', 'Caso 3 — PIR \\+ CSI'],
  ['/case/csi_dedicated', 'Caso 3 — PIR \\+ CSI'],
  ['/comparison', 'Comparación de métodos'],
  ['/system', 'Sistema y ensayos'],
  ['/test/pir-usb', 'Detección de Presencia'],
]) {
  test(`la ruta ${path} carga sus componentes en StrictMode`, async () => {
    window.history.replaceState(null, '', path);
    globalThis.fetch = async (url) => {
      if (url.endsWith('/health')) return json({
        status: 'healthy', version: '1', data_source: 'mqtt', mqtt_connected: true, active_ws_clients: 1,
        sqlite_persistence: {
          flush_interval_seconds: 2, pending_samples: 3, pending_calibrations: 0, committed_samples: 120,
          failed_writes: 0, oldest_pending_ms: 1200, last_batch_size: 24, last_write_ms: 4,
          p95_write_ms: 8, timed_batches: 10, last_oldest_to_commit_ms: 2004,
        },
      });
      if (url.endsWith('/comparison')) return json({ metrics: [], table: [] });
      if (url.endsWith('/trials') || url.endsWith('/readings')) return json([]);
      return json({ case_id: path.includes('dedicated') ? 'csi_dedicated' : path.includes('router') ? 'csi_router' : 'pir', total_tests: 0 });
    };
    await mount(createElement(StrictMode, null, createElement(App)));
    assert.match(document.body.textContent, new RegExp(heading));
    if (path === '/system') {
      assert.match(document.body.textContent, /Muestras pendientes en memoria3/);
      assert.match(document.body.textContent, /Escritura p95 \(10 lotes\)8 ms/);
    }
    assert.doesNotMatch(document.querySelector('nav').textContent, /Prueba PIR|Dedicado/);
    assert.equal(document.querySelector('nav a[href="/case/combined"]').textContent, 'Caso 3 — PIR + CSI');
    assert.doesNotMatch(document.body.textContent, /Prueba PIR por USB|Conectar ESP32/);
    assert.equal(FakeSocket.instances.filter((socket) => socket.readyState !== 3).length, 1);
  });
}
