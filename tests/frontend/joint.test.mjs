import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement, App, FakeSocket, mount, unmount, json, inputValue, deferred } from './reactHarness.mjs';

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
  const calibrationPanel = document.querySelector('[aria-label="Calibración CSI de la prueba conjunta"]');
  const environmentInput = document.querySelector('.joint-preparation-controls .trial-environment input');
  assert.ok(environmentInput);
  assert.equal(calibrationPanel.contains(environmentInput), false);
  assert.equal(environmentInput.required, false);
  const message = {
    type: 'telemetry_batch',
    data: {
      statuses: [
        { case_id: 'pir', is_connected: true, can_record_trial: true, presence: false, total_samples: 20, current_latency_ms: 0 },
        { case_id: 'csi_router', is_connected: true, can_record_trial: true, presence: true, total_samples: 90, current_latency_ms: 0 },
      ],
      cases: {
        pir: { raw_points: [{ timestamp: 1000, value: 0 }] },
        csi_router: {
          raw_points: [{ timestamp: 1000, value: 20 }],
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
  assert.equal(pirPanel.querySelectorAll('[_echarts_instance_] svg').length, 1);
  assert.equal(csiPanel.querySelectorAll('.joint-csi-indicators [_echarts_instance_] svg').length, 2);
  assert.match(csiPanel.textContent, /Movimiento del canal.*Forma del canal/);
  const subcarriers = document.querySelector('#mapas-csi');
  assert.equal(document.querySelector('#senales-en-vivo').nextElementSibling, subcarriers);
  assert.match(subcarriers.querySelector('.csi-heatmaps > .joint-mean-amplitude svg').textContent, /Amplitud media/);
  assert.equal(subcarriers.querySelectorAll('.csi-heatmap').length, 3);
  assert.deepEqual([...document.querySelectorAll('.joint-chart-links a')].map((link) => link.hash),
    ['#senales-en-vivo', '#mapas-csi']);
  const button = calibrationPanel.querySelector('button');
  assert.match(button.textContent, /Recalibrar/);
  await act(async () => inputValue(environmentInput, 'Casa A'));
  await act(async () => button.click());
  assert.deepEqual(posts, ['http://localhost:8000/api/v1/csi/csi_router/calibration']);

  message.data.cases.csi_router.calibration.state = 'calibrando';
  await act(async () => socket.receive(message));
  assert.equal(csiPanel.querySelector('fieldset'), null);
  assert.equal(pirPanel.querySelector('fieldset').disabled, false);
  message.data.cases.csi_router.calibration.state = 'calibrado';
  await act(async () => socket.receive(message));
  assert.equal(csiPanel.querySelector('fieldset').disabled, false);

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
  assert.equal(calibrationPanel.querySelector('button').disabled, true);
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
  assert.match(document.querySelector('#mapas-csi .joint-mean-amplitude svg').textContent, /Amplitud media/);
  assert.equal(document.querySelector('.joint-preparation .calibration-panel button').disabled, true);
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
        { case_id: 'csi_router', is_connected: true, can_record_trial: true },
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
  message.data.statuses[1].presence = true;
  await act(async () => socket.receive(message));
  const left = [...csi.querySelectorAll('button')].find((button) => button.textContent.includes('izquierda'));
  await act(async () => left.click());
  await act(async () => pir.querySelector('button').click());
  assert.deepEqual(requests.map(({ url, body: { observed_at: observedAt, ...body } }) => {
    assert.match(observedAt, /\.\d{3}Z$/);
    assert.ok(url.endsWith('/observations'));
    return body;
  }), [
    { case_id: 'csi_router', scenario: 'near_router', environment: 'Casa B' },
    { case_id: 'csi_router', scenario: 'left_of_pir', environment: 'Casa B' },
    { case_id: 'pir', scenario: 'present', environment: 'Casa B' },
  ]);
  await act(async () => firstSave.resolve(json({ id: 11, is_correct: false, ground_truth: true })));
  assert.match(csi.closest('.live-trial').querySelector('.form-notice').textContent, /Marca #12 guardada.*izquierda/);
});

test('los casos guardan ambientes independientes al cambiar de pantalla', async () => {
  globalThis.fetch = async (url) => {
    if (url.endsWith('/trials')) return json([]);
    if (url.includes('/csi/captures')) return json({ heatmaps: [], active_capture: null });
    return json({ total_tests: 0 });
  };
  const cases = [
    ['/case/pir', 'Ambiente PIR'],
    ['/case/csi_router', 'Ambiente CSI'],
    ['/case/combined', 'Ambiente conjunto'],
  ];

  for (const [path, environment] of cases) {
    window.history.replaceState(null, '', path);
    await mount(createElement(App));
    const input = document.querySelector('.trial-environment input');
    assert.equal(input.value, '');
    await act(async () => inputValue(input, environment));
    await unmount();
  }

  for (const [path, environment] of cases) {
    window.history.replaceState(null, '', path);
    await mount(createElement(App));
    assert.equal(document.querySelector('.trial-environment input').value, environment);
    await unmount();
  }
});
