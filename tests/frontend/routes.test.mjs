import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement, StrictMode, App, FakeSocket, mount, json } from './reactHarness.mjs';

test('la página CSI muestra los indicadores, sus umbrales y el estado de calibración', async () => {
  window.history.replaceState(null, '', '/case/csi_router');
  const posts = [];
  globalThis.fetch = async (url, options) => {
    if (options?.method === 'POST') {
      posts.push(url);
      return json({ state: 'esperando', message: 'Salí de la habitación', progress: 0, seconds_remaining: 10 });
    }
    return url.endsWith('/trials') ? json([]) : url.endsWith('/health') ? json({ data_source: 'mqtt' }) : json({ total_tests: 0 });
  };
  await mount(createElement(App));
  await act(async () => {
    const socket = FakeSocket.instances.at(-1);
    socket.open();
    socket.receive({
      type: 'telemetry_batch',
      data: {
        statuses: [{ case_id: 'csi_router', is_connected: true, presence: true, current_latency_ms: 10 }],
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
  const button = [...document.querySelectorAll('button')].find((element) => element.textContent.includes('Recalibrar'));
  await act(async () => button.click());
  assert.deepEqual(posts, ['http://localhost:8000/api/v1/csi/csi_router/calibration']);
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
      if (url.endsWith('/health')) return json({ status: 'healthy', version: '1', data_source: 'mqtt', mqtt_connected: true, active_ws_clients: 1 });
      if (url.endsWith('/comparison')) return json({ metrics: [], table: [] });
      if (url.endsWith('/trials') || url.endsWith('/readings')) return json([]);
      return json({ case_id: path.includes('dedicated') ? 'csi_dedicated' : path.includes('router') ? 'csi_router' : 'pir', total_tests: 0 });
    };
    await mount(createElement(StrictMode, null, createElement(App)));
    assert.match(document.body.textContent, new RegExp(heading));
    assert.doesNotMatch(document.querySelector('nav').textContent, /Prueba PIR|Dedicado/);
    assert.equal(document.querySelector('nav a[href="/case/combined"]').textContent, 'Caso 3 — PIR + CSI');
    assert.doesNotMatch(document.body.textContent, /Prueba PIR por USB|Conectar ESP32/);
    assert.equal(FakeSocket.instances.filter((socket) => socket.readyState !== 3).length, 1);
  });
}
