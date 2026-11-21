import assert from 'node:assert/strict';
import test from 'node:test';
import { act, App, createElement, inputValue, json, mount } from './reactHarness.mjs';

test('el historial filtra por día local y sensor y permite recorrer las páginas de SQLite', async () => {
  window.history.replaceState(null, '', '/comparison');
  const requests = [];
  globalThis.fetch = async (url) => {
    const { pathname, searchParams } = new URL(url);
    if (!pathname.endsWith('/telemetry/history')) return json({ data_source: 'mqtt' });
    requests.push(searchParams);
    if (searchParams.get('case_id') === 'pir') return json({ samples: [], next_cursor: null });

    const older = searchParams.has('before');
    return json({
      next_cursor: older ? null : 5,
      samples: [{
        id: older ? 2 : 5, case_id: 'csi_router', timestamp: '2026-10-24T09:15:00.512Z',
        presence: true, raw_value: 31.5, latency_ms: 10, calibration_state: 'calibrado', calibration_id: 12,
      }],
    });
  };
  await mount(createElement(App));
  const button = (text) => [...document.querySelectorAll('main button')].find((item) => item.textContent === text);
  const day = document.querySelector('input[type="date"]');
  await act(async () => inputValue(day, '2026-10-24'));
  assert.equal(requests.at(-1).get('start'), new Date(2026, 9, 24).toISOString());
  assert.equal(requests.at(-1).get('end'), new Date(2026, 9, 25).toISOString());
  assert.match(document.querySelector('tbody').textContent, /#5.*\d{2}:\d{2}:\d{2}\.512.*CSI Router.*Presencia.*#12/);
  await act(async () => button('Siguiente').click());
  assert.equal(requests.at(-1).get('before'), '5');
  assert.match(document.querySelector('tbody').textContent, /#2/);
  await act(async () => button('Anterior').click());
  assert.equal(requests.at(-1).has('before'), false);

  await act(async () => button('Siguiente').click());
  await act(async () => {
    const sensor = document.querySelector('main select');
    sensor.value = 'pir';
    sensor.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  assert.equal(requests.at(-1).get('case_id'), 'pir');
  assert.equal(requests.at(-1).has('before'), false);
  assert.match(document.querySelector('main').textContent, /No hay muestras guardadas/);
});
