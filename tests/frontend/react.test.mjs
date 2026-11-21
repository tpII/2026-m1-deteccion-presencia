import assert from 'node:assert/strict';
import test from 'node:test';
import {
  act, createElement, mount, unmount, root, deferred,
  useApiQuery, TelemetryProvider, useTelemetry, FakeSocket,
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
