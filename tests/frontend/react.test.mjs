import assert from 'node:assert/strict';
import test from 'node:test';
import {
  act, createElement, mount, unmount, root, deferred, json, inputValue,
  useApiQuery, TrialForm, TelemetryProvider, useTelemetry, FakeSocket,
  ThemeProvider, ComparisonBarChart,
} from './reactHarness.mjs';

test('una consulta cancelada no reemplaza los datos del caso nuevo', async () => {
  const oldResult = deferred();
  const newResult = deferred();
  let oldSignal, newSignal, query;
  const oldLoad = (signal) => { oldSignal = signal; return oldResult.promise; };
  const newLoad = (signal) => { newSignal = signal; return newResult.promise; };
  function Harness({ load }) { query = useApiQuery(load); return createElement('span', null, query.data); }
  await mount(createElement(Harness, { load: oldLoad }));
  await act(async () => root.render(createElement(Harness, { load: newLoad })));
  assert.equal(oldSignal.aborted, true);
  await act(async () => newResult.resolve('caso nuevo'));
  await act(async () => oldResult.resolve('caso anterior'));
  assert.equal(document.body.textContent, 'caso nuevo');
  assert.equal(query.loading, false);
  await unmount();
  assert.equal(newSignal.aborted, true);
});

test('una consulta fallida permite actualizar y recuperarse', async () => {
  let attempts = 0, query;
  const load = async () => {
    if (++attempts === 1) throw new Error('Backend sin conexión');
    return 'recuperado';
  };
  function Harness() { query = useApiQuery(load); return createElement('span', null, query.data); }
  await mount(createElement(Harness));
  assert.equal(query.error, 'Backend sin conexión');
  assert.equal(query.loading, false);
  await act(async () => query.refresh());
  assert.equal(query.error, null);
  assert.equal(query.data, 'recuperado');
});

test('el formulario valida latencia y bloquea envíos duplicados mientras guarda', async () => {
  const result = deferred();
  const requests = [];
  globalThis.fetch = (url, options) => { requests.push({ url, options }); return result.promise; };
  await mount(createElement(TrialForm));
  const form = document.querySelector('form');
  await act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(requests.length, 0);
  assert.match(document.querySelector('[role="alert"]').textContent, /latencia válida/);
  await act(async () => inputValue(document.querySelector('input[type="number"]'), '123.5'));
  await act(async () => {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.equal(requests.length, 1);
  assert.equal(JSON.parse(requests[0].options.body).latency_ms, 123.5);
  assert.equal(document.querySelector('button').disabled, true);
  await act(async () => result.resolve(json({ id: 1 })));
  assert.match(document.querySelector('[role="status"]').textContent, /registrado para PIR/);
  assert.equal(document.querySelector('button').disabled, false);
});

test('el formulario muestra el error HTTP y permite reintentar', async () => {
  globalThis.fetch = async () => new Response('', { status: 503 });
  await mount(createElement(TrialForm));
  await act(async () => inputValue(document.querySelector('input[type="number"]'), '10'));
  await act(async () => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
  assert.match(document.querySelector('[role="alert"]').textContent, /503/);
  assert.equal(document.querySelector('button').disabled, false);
});

test('la telemetría comparte la conexión y marca el sensor desconectado si cae el canal', async () => {
  function Sensor() {
    const { getCaseStatus } = useTelemetry();
    return createElement('span', null, String(getCaseStatus('pir')?.is_connected ?? false));
  }
  await mount(createElement(TelemetryProvider, null, createElement(Sensor), createElement(Sensor)));
  assert.equal(FakeSocket.instances.length, 1);
  const socket = FakeSocket.instances[0];
  await act(async () => {
    socket.open();
    socket.receive({ type: 'telemetry_batch', data: { statuses: [{ case_id: 'pir', is_connected: true }], cases: {} } });
  });
  assert.equal(document.body.textContent, 'truetrue');
  await act(async () => socket.close());
  assert.equal(document.body.textContent, 'falsefalse');
});

test('el gráfico etiqueta el método que realmente tiene ensayos', async () => {
  await mount(createElement(ThemeProvider, null, createElement(ComparisonBarChart, {
    metrics: [{ case_id: 'csi_router', detection_rate: 73 }],
    metricKey: 'detection_rate', title: 'Tasa de detección', unit: '%',
  })));
  assert.ok(document.querySelector('svg'));
  assert.match(document.body.textContent, /CSI Router/);
  assert.doesNotMatch(document.body.textContent, /PIR/);
  assert.match(document.body.textContent, /73 %/);
});
