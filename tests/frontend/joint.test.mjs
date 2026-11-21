import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement, App, FakeSocket, mount, json, inputValue, deferred } from './reactHarness.mjs';

test('la prueba conjunta muestra ambas fuentes sin crear una decisión combinada y calibra el caso router', async () => {
  window.history.replaceState(null, '', '/case/combined');
  const posts = [];
  globalThis.fetch = async (url, options) => {
    if (options?.method === 'POST') posts.push(url);
    return json({ data_source: 'mqtt' });
  };
  await mount(createElement(App));
  const socket = FakeSocket.instances.at(-1);
  const pirPanel = document.querySelector('[aria-label="PIR en la prueba conjunta"]');
  const csiPanel = document.querySelector('[aria-label="CSI en la prueba conjunta"]');
  const message = {
    type: 'telemetry_batch',
    data: {
      statuses: [
        { case_id: 'pir', is_connected: true, can_record_trial: true, sample_key: 'a'.repeat(32), presence: false, total_samples: 20, current_latency_ms: 0 },
        { case_id: 'csi_router', is_connected: true, can_record_trial: true, sample_key: 'b'.repeat(32), presence: true, total_samples: 90, current_latency_ms: 0 },
      ],
      cases: {
        pir: { raw_points: [{ timestamp: 1000, value: 0 }] },
        csi_router: {
          movement_points: [{ timestamp: 1000, value: 0.1 }],
          shape_points: [{ timestamp: 1000, value: 0.2 }],
          features: { movement_threshold: 0.01, shape_threshold: 0.05 },
          calibration: { state: 'calibrado', message: 'Calibrado con 300 paquetes.', progress: 1, seconds_remaining: 0 },
        },
      },
    },
  };
  await act(async () => { socket.open(); socket.receive(message); });
  assert.match(document.body.textContent, /2 de 2 sensores en línea/);
  assert.match(pirPanel.textContent, /SIN MOVIMIENTO/);
  assert.match(pirPanel.textContent, /20/);
  assert.match(csiPanel.textContent, /PRESENCIA/);
  assert.match(csiPanel.textContent, /90/);
  assert.equal(document.querySelectorAll('[_echarts_instance_] svg').length, 3);
  const button = [...csiPanel.querySelectorAll('button')].find((item) => item.textContent.includes('Recalibrar'));
  await act(async () => inputValue(document.querySelector('.trial-environment input'), 'Casa A'));
  await act(async () => button.click());
  assert.deepEqual(posts, ['http://localhost:8000/api/v1/csi/csi_router/calibration']);

  // A fresh PIR result and CSI calibration update are reflected independently.
  message.data.statuses[0].presence = true;
  message.data.cases.csi_router.calibration.state = 'sin_calibrar';
  await act(async () => socket.receive(message));
  assert.doesNotMatch(pirPanel.textContent, /SIN MOVIMIENTO/);
  assert.match(csiPanel.textContent, /SIN CALIBRAR/);
  assert.doesNotMatch(csiPanel.textContent, /PRESENCIA/);
  assert.equal(csiPanel.querySelector('fieldset'), null);
  await act(async () => socket.close());
  assert.match(document.body.textContent, /0 de 2 sensores en línea/);
  assert.match(pirPanel.textContent, /SIN LECTURA/);
  assert.match(csiPanel.textContent, /SIN LECTURA/);
  assert.equal([...csiPanel.querySelectorAll('button')][0].disabled, true);
});

test('la prueba conjunta funciona con una sola fuente y no habilita calibración sin CSI', async () => {
  window.history.replaceState(null, '', '/case/combined');
  globalThis.fetch = async () => json({ data_source: 'mqtt' });
  await mount(createElement(App));
  const socket = FakeSocket.instances.at(-1);
  await act(async () => {
    socket.open();
    socket.receive({ type: 'telemetry_batch', data: {
      statuses: [{ case_id: 'pir', is_connected: true, presence: true, total_samples: 2 }],
      cases: { pir: { raw_points: [{ timestamp: 1000, value: 1 }] } },
    } });
  });
  assert.match(document.body.textContent, /1 de 2 sensores en línea/);
  const csiPanel = document.querySelector('[aria-label="CSI en la prueba conjunta"]');
  assert.match(csiPanel.textContent, /SIN LECTURA/);
  assert.equal(csiPanel.querySelector('button').disabled, true);
});

test('la prueba conjunta usa un ambiente compartido y guarda la observación del método elegido', async () => {
  window.history.replaceState(null, '', '/case/combined');
  const requests = [];
  const firstSave = deferred();
  globalThis.fetch = async (url, options) => {
    if (options?.method === 'POST') {
      requests.push({ url, body: JSON.parse(options.body) });
      if (requests.length === 1) return firstSave.promise;
    }
    return json({ id: 12, is_correct: false, ground_truth: true });
  };
  await mount(createElement(App));
  const socket = FakeSocket.instances.at(-1);
  const message = { type: 'telemetry_batch', data: {
      statuses: [
        { case_id: 'pir', is_connected: true, can_record_trial: false },
        { case_id: 'csi_router', is_connected: true, can_record_trial: true, sample_key: 'c'.repeat(32) },
      ],
      cases: { csi_router: { calibration: { state: 'calibrado', progress: 1 } } },
    } };
  await act(async () => {
    socket.open();
    socket.receive(message);
  });
  const pir = document.querySelector('[aria-label="PIR en la prueba conjunta"] fieldset');
  const csi = document.querySelector('[aria-label="CSI en la prueba conjunta"] fieldset');
  assert.equal(document.querySelector('.trial-environment button'), null);
  assert.match(document.querySelector('.sensor-topics').textContent, /PIR · Online/);
  assert.equal(csi.disabled, true);
  await act(async () => inputValue(document.querySelector('.trial-environment input'), ' Casa B '));
  assert.equal(pir.disabled, false);
  assert.equal(csi.disabled, false);
  const nearRouter = [...csi.querySelectorAll('button')].find((button) => button.textContent.includes('router Wi-Fi'));
  await act(async () => nearRouter.click());
  message.data.statuses[1].sample_key = 'd'.repeat(32);
  await act(async () => socket.receive(message));
  const left = [...csi.querySelectorAll('button')].find((button) => button.textContent.includes('izquierda'));
  await act(async () => left.click());
  assert.deepEqual(requests.map(({ url, body: { observed_at: observedAt, ...body } }) => {
    assert.match(observedAt, /\.\d{3}Z$/);
    assert.ok(url.endsWith('/observations'));
    return body;
  }), [
    { case_id: 'csi_router', scenario: 'near_router', environment: 'Casa B' },
    { case_id: 'csi_router', scenario: 'left_of_pir', environment: 'Casa B' },
  ]);
  await act(async () => firstSave.resolve(json({ id: 11, is_correct: false, ground_truth: true })));
  assert.match(document.querySelector('.form-notice').textContent, /Marca #12 guardada.*izquierda/);
});

test('el registro y la comparación solo ofrecen PIR y CSI router aunque exista historial dedicado', async () => {
  window.history.replaceState(null, '', '/system');
  globalThis.fetch = async (url) => url.endsWith('/comparison') ? json({
    metrics: [{ case_id: 'csi_dedicated', total_tests: 5, detection_rate: 90 }],
    table: [{ metric: 'Exactitud', unit: '%', pir: 'Sin ensayos', csi_router: 'Sin ensayos', csi_dedicated: '90 %' }],
  }) : json({ data_source: 'mqtt' });
  await mount(createElement(App));
  assert.deepEqual([...document.querySelectorAll('select')[0].options].map((item) => item.value), ['pir', 'csi_router']);
  await act(async () => document.querySelector('nav a[href="/comparison"]').click());
  assert.doesNotMatch(document.body.textContent, /CSI Dedicado|90 %/);
  assert.match(document.body.textContent, /Sin ensayos registrados para comparar/);
  assert.equal(document.querySelectorAll('thead th').length, 4);
});
