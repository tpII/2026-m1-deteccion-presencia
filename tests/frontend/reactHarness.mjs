import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { after, afterEach } from 'node:test';

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

export const { createElement, StrictMode, act } = require('react');
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
export const { useApiQuery } = await server.ssrLoadModule('/src/hooks/useApiQuery.ts');
export const { TrialForm } = await server.ssrLoadModule('/src/components/system/TrialForm.tsx');
export const { ThemeProvider } = await server.ssrLoadModule('/src/context/ThemeContext.tsx');
export const { TelemetryProvider } = await server.ssrLoadModule('/src/context/TelemetryContext.tsx');
export const { useTelemetry } = await server.ssrLoadModule('/src/hooks/useTelemetry.ts');
export const { ComparisonBarChart } = await server.ssrLoadModule('/src/components/charts/ComparisonBarChart.tsx');
export const { default: App } = await server.ssrLoadModule('/src/App.tsx');
const originalFetch = globalThis.fetch;
const originalWebSocket = globalThis.WebSocket;
export let root;

export class FakeSocket {
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

export function deferred() {
  let resolve;
  const promise = new Promise((finish) => { resolve = finish; });
  return { promise, resolve };
}

export async function mount(element) {
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(element));
}

export function json(value) {
  return new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
}

export function inputValue(element, value) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value);
  element.dispatchEvent(new window.Event('input', { bubbles: true }));
}

export async function unmount() {
  if (root) await act(async () => root.unmount());
  root = null;
}

afterEach(async () => {
  await unmount();
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
