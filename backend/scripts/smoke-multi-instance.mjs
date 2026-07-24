// Cross-instance check for the Redis Socket.IO adapter.
// Start two API instances sharing Redis, then point WS_A and WS_B at them:
//   WS_A=http://localhost:3000 WS_B=http://localhost:3001 pnpm smoke:multi
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { io } from 'socket.io-client';

const API_URL = process.env.API_URL ?? 'http://localhost:3000/api';
const WS_A = process.env.WS_A ?? API_URL.replace(/\/api\/?$/, '');
const WS_B = process.env.WS_B ?? 'http://localhost:3001';
const suffix = Date.now().toString(36);

async function request(path, { method = 'GET', token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  assert.ok(response.ok, `${method} ${path} -> ${response.status} ${text}`);
  return parsed;
}

function connect(url, token) {
  return io(url, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
    timeout: 5_000,
  });
}

function waitForConnect(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('connect timeout')), 5_000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function waitFor(socket, event, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function waitForMatch(socket, event, predicate, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for matching ${event}`)),
      timeoutMs,
    );
    const handler = (payload) => {
      if (!predicate(payload)) {
        return;
      }
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

function emitAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket
      .timeout(5_000)
      .emit(event, payload, (error, response) => (error ? reject(error) : resolve(response)));
  });
}

async function main() {
  let socketA;
  let socketB;

  try {
    const alice = await request('/auth/register', {
      method: 'POST',
      body: {
        email: `multi-a-${suffix}@example.com`,
        username: `multi_a_${suffix}`,
        password: 'Password123!',
      },
    });
    const bob = await request('/auth/register', {
      method: 'POST',
      body: {
        email: `multi-b-${suffix}@example.com`,
        username: `multi_b_${suffix}`,
        password: 'Password123!',
      },
    });

    const room = await request('/rooms', {
      method: 'POST',
      token: alice.accessToken,
      body: { type: 'PUBLIC', name: `multi-${suffix}` },
    });
    await request(`/rooms/${room.id}/join`, { method: 'POST', token: bob.accessToken });

    socketA = connect(WS_A, alice.accessToken);
    socketB = connect(WS_B, bob.accessToken);
    const snapshotEvent = waitFor(socketB, 'presence:snapshot');
    await Promise.all([waitForConnect(socketA), waitForConnect(socketB)]);
    const snapshot = await snapshotEvent;
    assert.ok(
      snapshot.users.some((entry) => entry.userId === alice.user.id && entry.status === 'online'),
      'presence snapshot crossed from instance A to instance B',
    );
    await new Promise((resolve) => setTimeout(resolve, 500));

    const incoming = waitFor(socketB, 'message:new');
    const ack = await emitAck(socketA, 'message:send', {
      roomId: room.id,
      content: 'across instances',
      clientMessageId: randomUUID(),
    });

    assert.equal(ack.ok, true, JSON.stringify(ack));
    const received = await incoming;
    assert.equal(received.id, ack.data.id, 'message crossed from instance A to instance B');

    const typingEvent = waitForMatch(
      socketB,
      'typing:update',
      (update) => update.userId === alice.user.id && update.isTyping,
    );
    const typingAck = await emitAck(socketA, 'typing:start', { roomId: room.id });
    assert.equal(typingAck.ok, true, JSON.stringify(typingAck));
    await typingEvent;

    const offlineEvent = waitForMatch(
      socketB,
      'presence:update',
      (update) => update.userId === alice.user.id && update.status === 'offline',
    );
    socketA.disconnect();
    await offlineEvent;

    console.log(
      `Multi-instance smoke passed: ${WS_A} -> ${WS_B} via Redis adapter (message, typing, presence)`,
    );
  } finally {
    socketA?.disconnect();
    socketB?.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
