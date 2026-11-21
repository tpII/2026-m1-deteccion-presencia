import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement, App, FakeSocket, mount, json, inputValue, transformClientModule } from './reactHarness.mjs';

test('Vite inicializa memo antes de crear el gráfico en el cliente de desarrollo', async () => {
  const { code } = await transformClientModule('/src/components/charts/CsiHeatmaps.tsx');
  const importPosition = code.search(/(?:const memo =|import\s*\{[^}]*\bmemo\b)/);
  const firstUse = code.indexOf('const Heatmap =');
  assert.ok(importPosition >= 0 && firstUse > importPosition, 'El cliente debe importar memo antes de usarlo.');
});

for (const path of ['/case/csi_router', '/case/combined']) {
  test(`CSI muestra las tres actividades y actualiza la captura activa en ${path}`, async () => {
    window.history.replaceState(null, '', path);
    const requests = [];
    const startsAt = new Date().toISOString();
    const endsAt = new Date(Date.now() + 300_000).toISOString();
    let activeCapture = null;
    let previewRequests = 0;
    function heatmap(capture, columns = 5) {
      return {
        capture, step_seconds: 0.25, column_count: columns,
        columns: [{ index: 2, relative_amplitudes: Array.from({ length: 55 }, (_, index) => 0.5 + index / 54) }],
      };
    }
    const archived = ['empty', 'seated'].map((activity, index) =>
      heatmap({ id: index + 1, environment: 'Casa A', activity, starts_at: startsAt, ends_at: endsAt }));
    const heatmaps = [...archived];
    globalThis.fetch = async (url, options) => {
      if (url.endsWith('/csi/captures') && options.method === 'POST') {
        const body = JSON.parse(options.body);
        requests.push(body);
        activeCapture = { id: 9, ...body, starts_at: startsAt, ends_at: endsAt };
        return json(activeCapture);
      }
      if (url.endsWith('/csi/captures/9/finish')) {
        requests.push('finish');
        const capture = activeCapture;
        activeCapture = null;
        heatmaps.push(heatmap(capture));
        return json(capture);
      }
      if (url.endsWith('/csi/captures/9/preview')) {
        previewRequests += 1;
        return json({ active: true, heatmap: heatmap(activeCapture, 5 + previewRequests) });
      }
      if (url.includes('/csi/captures')) {
        return json({ active_capture: activeCapture, as_of: startsAt, heatmaps });
      }
      return url.endsWith('/trials') ? json([]) : json({ total_tests: 0 });
    };
    await mount(createElement(App));
    const panel = document.querySelector('.csi-capture-panel');
    assert.equal(panel.querySelector('button').disabled, true);
    await act(async () => {
      const socket = FakeSocket.instances.at(-1);
      socket.open();
      socket.receive({ type: 'telemetry_batch', data: {
        statuses: [{ case_id: 'csi_router', is_connected: true }],
        cases: {},
      } });
      inputValue(document.querySelector('.trial-environment input'), ' Casa A ');
    });
    assert.equal(panel.querySelector('select'), null);
    const [empty, walking, seated] = panel.querySelectorAll('.csi-heatmap');
    const emptyPlot = empty.querySelector('svg');
    const seatedPlot = seated.querySelector('svg');
    assert.ok(emptyPlot && seatedPlot);
    assert.equal(walking.querySelector('button').disabled, false);
    await act(async () => walking.querySelector('button').click());
    assert.match(panel.querySelector('[role="status"]').textContent, /Caminando en Casa A/);
    assert.match(walking.querySelector('button').textContent, /Finalizar captura/);
    assert.match(walking.textContent, /En vivo/);
    assert.equal(previewRequests, 1);
    assert.ok(walking.querySelector('svg'));
    assert.equal(empty.querySelector('svg'), emptyPlot);
    assert.equal(seated.querySelector('svg'), seatedPlot);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 1100)));
    assert.ok(previewRequests >= 2);
    await act(async () => walking.querySelector('button').click());
    assert.deepEqual(requests, [{ environment: 'Casa A', activity: 'walking' }, 'finish']);
    assert.deepEqual([...panel.querySelectorAll('h4')].map((heading) => heading.textContent),
      ['Vacío', 'Caminando', 'Sentado quieto']);
    assert.ok(walking.querySelector('svg'));
    assert.doesNotMatch(walking.textContent, /En vivo/);
    assert.match(panel.querySelector('.csi-heatmap-scale').textContent, /0.5.*1.5/);
  });
}
