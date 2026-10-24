import assert from 'node:assert/strict';
import test from 'node:test';
import { loadFrontendModule } from './loadModule.mjs';

const { WebSocketClient } = await loadFrontendModule('services/websocket.ts', (source) =>
  source.replace("import { ENV } from '../config/env';", "const ENV = { WS_URL: 'ws://localhost/ws/telemetry' };")
);

function setup(t) {
  const sockets = [];
  const original = globalThis.WebSocket;
  class FakeSocket {
    static OPEN = 1;
    readyState = 0;
    sent = [];
    constructor() { sockets.push(this); }
    open() { this.readyState = 1; this.onopen?.(); }
    close() { this.readyState = 3; this.onclose?.(); }
    send(message) { this.sent.push(message); }
    receive(message) { this.onmessage?.({ data: JSON.stringify(message) }); }
  }
  globalThis.WebSocket = FakeSocket;
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const client = new WebSocketClient();
  t.after(() => {
    client.disconnect();
    globalThis.WebSocket = original;
  });
  return { client, sockets };
}

test('comparte una conexión y envía heartbeat solamente mientras está activa', (t) => {
  const { client, sockets } = setup(t);
  client.connect();
  client.connect();
  assert.equal(sockets.length, 1);
  sockets[0].open();
  assert.equal(client.getState(), 'LIVE');
  t.mock.timers.tick(15000);
  assert.deepEqual(sockets[0].sent, ['ping']);
  client.disconnect();
  t.mock.timers.tick(30000);
  assert.equal(client.getState(), 'OFFLINE');
  assert.equal(sockets.length, 1);
  assert.deepEqual(sockets[0].sent, ['ping']);
});

test('error y cierre programan una sola reconexión', (t) => {
  const { client, sockets } = setup(t);
  client.connect();
  sockets[0].open();
  sockets[0].onerror();
  sockets[0].onclose();
  assert.equal(client.getState(), 'RECONNECTING');
  t.mock.timers.tick(1000);
  assert.equal(sockets.length, 2);
  sockets[1].open();
  assert.equal(client.getState(), 'LIVE');
});

test('el cierre tardío de una conexión anterior no interrumpe la nueva', (t) => {
  const { client, sockets } = setup(t);
  client.connect();
  const previous = sockets[0];
  client.disconnect();
  client.connect();
  sockets[1].open();
  previous.onclose();
  assert.equal(client.getState(), 'LIVE');
  t.mock.timers.tick(5000);
  assert.equal(sockets.length, 2);
});

test('las suscripciones reciben telemetría y dejan de recibir al desmontarse', (t) => {
  const { client, sockets } = setup(t);
  const received = [];
  const unsubscribe = client.subscribe((message) => received.push(message));
  client.connect();
  sockets[0].open();
  const initial = { type: 'initial_state', data: { statuses: [], cases: {} } };
  sockets[0].receive(initial);
  sockets[0].receive({ type: 'heartbeat' });
  assert.deepEqual(received, [initial]);
  unsubscribe();
  sockets[0].receive({ type: 'telemetry_batch', data: { statuses: [], cases: {} } });
  assert.equal(received.length, 1);
});
