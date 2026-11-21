import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { act, createElement, mount, ScreenErrorBoundary, ThemeProvider } from './reactHarness.mjs';
import { loadFrontendModule } from './loadModule.mjs';

test('si falla el módulo de arranque, el HTML conserva un mensaje y un enlace para recargar', async (context) => {
  const html = await readFile(new URL('../../frontend/index.html', import.meta.url), 'utf8');
  const startup = new window.DOMParser().parseFromString(html, 'text/html').getElementById('app-startup');
  document.body.append(startup);
  context.after(() => startup.remove());
  context.mock.method(console, 'error', () => {});
  assert.match(startup.textContent, /Cargando el panel/);
  await loadFrontendModule('bootstrap.ts', (source) =>
    source.replace("import('./main')", "Promise.reject(new Error('Módulo no disponible'))"));
  assert.match(startup.textContent, /El panel no pudo terminar de cargar/);
  assert.equal(startup.querySelector('a').getAttribute('href'), '');
});

test('se puede reintentar una pantalla que falla mientras el resto permanece montado', async (context) => {
  context.mock.method(console, 'error', () => {});
  let fail = true;
  function Screen() {
    if (fail) throw new Error('Error simulado de pantalla');
    return createElement('h2', null, 'Telemetría recuperada');
  }
  await mount(createElement('div', null,
    createElement('input', { defaultValue: 'Ambiente en preparación' }),
    createElement(ScreenErrorBoundary, null, createElement(Screen)),
  ));
  assert.match(document.querySelector('[role="alert"]').textContent, /Esta pantalla no pudo cargarse/);
  const draft = document.querySelector('input');
  fail = false;
  await act(async () => document.querySelector('[role="alert"] button').click());
  assert.match(document.body.textContent, /Telemetría recuperada/);
  assert.equal(document.querySelector('input'), draft);
  assert.equal(draft.value, 'Ambiente en preparación');
});

test('el navegador con almacenamiento bloqueado puede cargar el tema', async () => {
  const storage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new window.DOMException('Almacenamiento bloqueado', 'SecurityError'); },
  });
  try {
    await mount(createElement(ThemeProvider, null, createElement('p', null, 'Tema disponible')));
    assert.match(document.body.textContent, /Tema disponible/);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  }
});
