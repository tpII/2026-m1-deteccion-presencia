import assert from 'node:assert/strict';
import test from 'node:test';
import { loadFrontendModule } from './loadModule.mjs';

const { PirSerialConnection, getPirSerialSupportError } = await loadFrontendModule('services/pirSerial.ts');

function setup(t, options = {}) {
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let controller;
  const stream = new ReadableStream({ start(value) { controller = value; } });
  const readings = [];
  const states = [];
  const errors = [];
  const waiters = [];
  let requests = 0;
  let opens = 0;
  let closes = 0;
  const port = {
    readable: stream,
    async open(settings) {
      assert.deepEqual(settings, { baudRate: 115200 });
      opens++;
      if (options.open) await options.open();
    },
    async close() {
      assert.equal(stream.locked, false, 'El reader debe liberarse antes de cerrar el puerto');
      closes++;
    },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { isSecureContext: options.secure ?? true } });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: options.unsupported ? {} : {
      serial: {
        async requestPort() {
          requests++;
          return options.requestPort ? options.requestPort(port) : port;
        },
      },
    },
  });
  const connection = new PirSerialConnection({
    onReading: (reading) => readings.push(reading),
    onStateChange: (state) => { states.push(state); notify(); },
    onError: (error) => errors.push(error),
  });
  function notify() {
    for (const waiter of waiters) {
      if (waiter.state === states.at(-1)) waiter.resolve();
    }
  }
  t.after(async () => {
    await connection.disconnect();
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator);
    else delete globalThis.navigator;
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
  });
  return {
    connection, readings, states, errors, port,
    counts: () => ({ requests, opens, closes }),
    send: (text) => controller.enqueue(new TextEncoder().encode(text)),
    fail: () => controller.error(new DOMException('USB retirado', 'NetworkError')),
    end: () => controller.close(),
    waitForState: (state) => states.at(-1) === state ? Promise.resolve() : new Promise((resolve) => waiters.push({ state, resolve })),
  };
}

test('reconstruye mensajes partidos, CRLF y varios mensajes; ignora texto ajeno', { timeout: 2000 }, async (t) => {
  const h = setup(t);
  h.connection.connect();
  await h.waitForState('connected');
  h.send('ESP32 boot\r\nMOVI');
  h.send('MIENTO\r');
  h.send('\n SIN MOVIMIENTO \r\nMOVIMIENTO\n\nERROR MOVIMIENTO\nMOV');
  h.end();
  await h.waitForState('disconnected');
  assert.deepEqual(h.readings.map(({ message, motion }) => ({ message, motion })), [
    { message: 'MOVIMIENTO', motion: true },
    { message: 'SIN MOVIMIENTO', motion: false },
    { message: 'MOVIMIENTO', motion: true },
  ]);
  assert.ok(h.readings.every((reading) => Number.isFinite(reading.receivedAt)));
  assert.equal(h.counts().closes, 1);
});

test('descarta una línea demasiado larga sin interpretar su sufijo como movimiento', { timeout: 2000 }, async (t) => {
  const h = setup(t);
  h.connection.connect();
  await h.waitForState('connected');
  h.send('x'.repeat(300));
  h.send('MOVIMIENTO\nSIN MOVIMIENTO\n');
  h.end();
  await h.waitForState('disconnected');
  assert.deepEqual(h.readings.map((reading) => reading.motion), [false]);
});

test('desconecta sin datos y permite volver a conectar sin abrir dos lectores', { timeout: 2000 }, async (t) => {
  const h = setup(t);
  h.connection.connect();
  h.connection.connect();
  await h.waitForState('connected');
  await h.connection.disconnect();
  assert.deepEqual(h.counts(), { requests: 1, opens: 1, closes: 1 });
  assert.deepEqual(h.errors, []);
  assert.equal(h.states.at(-1), 'disconnected');
  // Un puerto real ofrece un stream nuevo al abrirse de nuevo.
  h.port.readable = new ReadableStream();
  h.connection.connect();
  await h.waitForState('connected');
  await h.connection.disconnect();
  assert.deepEqual(h.counts(), { requests: 2, opens: 2, closes: 2 });
});

test('cerrar el selector no muestra error ni intenta cerrar un puerto sin abrir', { timeout: 2000 }, async (t) => {
  const h = setup(t, { requestPort: () => { throw new DOMException('Cancelado', 'NotFoundError'); } });
  h.connection.connect();
  await h.waitForState('disconnected');
  assert.deepEqual(h.errors, []);
  assert.deepEqual(h.counts(), { requests: 1, opens: 0, closes: 0 });
});

test('informa puerto ocupado y permite reintentar', { timeout: 2000 }, async (t) => {
  let occupied = true;
  const h = setup(t, { open: () => { if (occupied) throw new DOMException('Puerto ocupado', 'NetworkError'); } });
  h.connection.connect();
  await h.waitForState('disconnected');
  assert.match(h.errors[0], /Puerto ocupado/);
  assert.equal(h.counts().closes, 0);
  occupied = false;
  h.connection.connect();
  await h.waitForState('connected');
  await h.connection.disconnect();
  assert.equal(h.counts().closes, 1);
});

test('desenchufar el USB libera el reader y vuelve a desconectado', { timeout: 2000 }, async (t) => {
  const h = setup(t);
  h.connection.connect();
  await h.waitForState('connected');
  h.fail();
  await h.waitForState('disconnected');
  assert.match(h.errors[0], /USB retirado/);
  assert.equal(h.counts().closes, 1);
});

test('salir mientras el selector está abierto impide abrir el puerto seleccionado después', { timeout: 2000 }, async (t) => {
  let select;
  const h = setup(t, { requestPort: (port) => new Promise((resolve) => { select = () => resolve(port); }) });
  h.connection.connect();
  const closing = h.connection.disconnect();
  select();
  await closing;
  assert.deepEqual(h.counts(), { requests: 1, opens: 0, closes: 0 });
  assert.deepEqual(h.errors, []);
});

test('salir durante open cierra el puerto al terminar de abrir', { timeout: 2000 }, async (t) => {
  let finishOpen;
  let startedOpen;
  const opening = new Promise((resolve) => { startedOpen = resolve; });
  const h = setup(t, { open: () => new Promise((resolve) => { finishOpen = resolve; startedOpen(); }) });
  h.connection.connect();
  await opening;
  const closing = h.connection.disconnect();
  finishOpen();
  await closing;
  assert.deepEqual(h.counts(), { requests: 1, opens: 1, closes: 1 });
  assert.equal(h.states.includes('connected'), false);
});

test('explica contexto inseguro o navegador sin soporte antes de pedir un puerto', { timeout: 2000 }, async (t) => {
  const h = setup(t, { secure: false });
  assert.match(getPirSerialSupportError(), /localhost/);
  h.connection.connect();
  await h.waitForState('disconnected');
  assert.equal(h.counts().requests, 0);
  window.isSecureContext = true;
  delete navigator.serial;
  assert.match(getPirSerialSupportError(), /Chrome o Edge/);
});
