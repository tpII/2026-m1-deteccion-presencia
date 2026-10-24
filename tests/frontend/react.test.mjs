import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test, { after, afterEach } from 'node:test';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost:5173/' });
const originals = new Map();
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'localStorage']) {
  originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
window.matchMedia = () => ({ matches: false });
window.HTMLCanvasElement.prototype.getContext = () => ({ measureText: (text) => ({ width: String(text).length * 7 }) });
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { createElement, StrictMode, act } = require('react');
const { createRoot } = require('react-dom/client');
const { createServer } = await import(require.resolve('vite'));
const frontendRoot = fileURLToPath(new URL('../../frontend', import.meta.url));
const server = await createServer({
  root: frontendRoot,
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  appType: 'custom',
  ssr: {
    noExternal: ['react-router', 'react-router-dom'],
    resolve: { conditions: ['module', 'import', 'development'] },
  },
  plugins: [{
    name: 'svg-charts-in-jsdom',
    enforce: 'pre',
    transform(source, id) {
      if (!id.endsWith('/src/services/charts.ts')) return;
      return source
        .replace('import { init, use, graphic }', 'import { init as initCore, use, graphic }')
        .replaceAll('CanvasRenderer', 'SVGRenderer')
        .replace('export { init, graphic };', `export { graphic };
          export function init(element, theme) {
            return initCore(element, theme, { renderer: 'svg', width: 800, height: 300 });
          }`);
    },
  }],
});
const { useApiQuery } = await server.ssrLoadModule('/src/hooks/useApiQuery.ts');
const { TrialForm } = await server.ssrLoadModule('/src/components/system/TrialForm.tsx');
const { ThemeProvider } = await server.ssrLoadModule('/src/context/ThemeContext.tsx');
const { TelemetryProvider } = await server.ssrLoadModule('/src/context/TelemetryContext.tsx');
const { useTelemetry } = await server.ssrLoadModule('/src/hooks/useTelemetry.ts');
const { ComparisonBarChart } = await server.ssrLoadModule('/src/components/charts/ComparisonBarChart.tsx');
const { default: App } = await server.ssrLoadModule('/src/App.tsx');
const originalFetch = globalThis.fetch;
const originalWebSocket = globalThis.WebSocket;
let root;

class FakeSocket {
  static OPEN = 1;
  static instances = [];
  readyState = 0;
  constructor() { FakeSocket.instances.push(this); }
  open() { this.readyState = 1; this.onopen?.(); }
  close() { this.readyState = 3; this.onclose?.(); }
  send() {}
  receive(data) { this.onmessage?.({ data: JSON.stringify(data) }); }
}
globalThis.WebSocket = FakeSocket;

function deferred() {
  let resolve;
  const promise = new Promise((finish) => { resolve = finish; });
  return { promise, resolve };
}

async function mount(element) {
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(element));
}

function json(value) {
  return new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
}

function inputValue(element, value) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value);
  element.dispatchEvent(new window.Event('input', { bubbles: true }));
}

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  globalThis.fetch = originalFetch;
  FakeSocket.instances = [];
  localStorage.clear();
});

after(async () => {
  await server.close();
  globalThis.WebSocket = originalWebSocket;
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
  delete globalThis.ResizeObserver;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  dom.window.close();
});

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
  await act(async () => root.unmount());
  root = null;
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
    metrics: [{ case_id: 'csi_dedicated', detection_rate: 73 }],
    metricKey: 'detection_rate', title: 'Tasa de detección', unit: '%',
  })));
  assert.ok(document.querySelector('svg'));
  assert.match(document.body.textContent, /CSI Dedicado/);
  assert.doesNotMatch(document.body.textContent, /PIR/);
  assert.match(document.body.textContent, /73 %/);
});

test('la página CSI muestra señales y características recibidas por WebSocket', async () => {
  window.history.replaceState(null, '', '/case/csi_router');
  globalThis.fetch = async (url) => url.endsWith('/trials')
    ? json([]) : url.endsWith('/health') ? json({ data_source: 'mqtt' }) : json({ total_tests: 0 });
  await mount(createElement(App));
  await act(async () => {
    const socket = FakeSocket.instances.at(-1);
    socket.open();
    socket.receive({
      type: 'telemetry_batch',
      data: {
        statuses: [{ case_id: 'csi_router', is_connected: true, presence: false, current_latency_ms: 10 }],
        cases: {
          csi_router: {
            case_id: 'csi_router', presence: false, current_score: 0.25,
            raw_points: [{ timestamp: 1000, value: 20 }, { timestamp: 1500, value: 23 }],
            filtered_points: [{ timestamp: 1000, value: 21 }, { timestamp: 1500, value: 22 }],
            filter_metadata: { name: 'Hampel + Moving Average', parameters: { hampel_window: 7, moving_average_window: 5 } },
            features: { variance: 1.234, energy: 23, detection_score: 0.25, threshold_applied: 2.2 },
          },
        },
      },
    });
  });
  assert.equal(document.querySelectorAll('[_echarts_instance_] svg').length, 3);
  assert.match(document.body.textContent, /1\.234/);
  assert.match(document.body.textContent, /25\.0%/);
  assert.match(document.body.textContent, /Hampel \+ Moving Average/);
});

for (const [path, heading] of [
  ['/', 'Detección de Presencia'],
  ['/case/pir', 'Sensor Infrarrojo'],
  ['/case/csi_router', 'Router Wi-Fi'],
  ['/case/csi_dedicated', 'Red Dedicada'],
  ['/comparison', 'Comparación de métodos'],
  ['/system', 'Sistema y ensayos'],
  ['/test/pir-usb', 'Prueba PIR por USB'],
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
    assert.equal(FakeSocket.instances.filter((socket) => socket.readyState !== 3).length, 1);
  });
}
