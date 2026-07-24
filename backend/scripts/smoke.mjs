// End-to-end smoke test: REST + two authenticated Socket.IO clients.
// Usage: start the API, then run `pnpm smoke` from the repo root.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { io } from 'socket.io-client';

const API_URL = process.env.API_URL ?? 'http://localhost:3000/api';
const WS_URL = process.env.WS_URL ?? API_URL.replace(/\/api\/?$/, '');
const suffix = Date.now().toString(36);

async function api(path, { method = 'GET', token, body } = {}) {
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
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function request(path, options) {
  const { status, body } = await api(path, options);
  assert.ok(
    status < 400,
    `${options?.method ?? 'GET'} ${path} -> ${status} ${JSON.stringify(body)}`,
  );
  return body;
}

function connect(token) {
  return io(WS_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
    timeout: 5_000,
  });
}

function waitForConnect(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket connect timed out')), 5_000);
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
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeoutMs);
    const handler = (payload) => {
      clearTimeout(timer);
      resolve(payload);
    };
    socket.once(event, handler);
  });
}

function waitForMatch(socket, event, predicate, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for matching "${event}"`));
    }, timeoutMs);
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
    socket.timeout(5_000).emit(event, payload, (error, response) => {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}

function sendMessage(socket, payload) {
  return emitAck(socket, 'message:send', payload);
}

async function main() {
  let socketA;
  let socketB;
  let socketC;
  let unauthenticatedSocket;

  try {
    const alice = await request('/auth/register', {
      method: 'POST',
      body: {
        email: `smoke-a-${suffix}@example.com`,
        username: `smoke_a_${suffix}`,
        password: 'Password123!',
      },
    });
    const bob = await request('/auth/register', {
      method: 'POST',
      body: {
        email: `smoke-b-${suffix}@example.com`,
        username: `smoke_b_${suffix}`,
        password: 'Password123!',
      },
    });

    const room = await request('/rooms', {
      method: 'POST',
      token: alice.accessToken,
      body: { type: 'PUBLIC', name: `smoke-${suffix}` },
    });
    await request(`/rooms/${room.id}/join`, { method: 'POST', token: bob.accessToken });

    socketA = connect(alice.accessToken);
    socketB = connect(bob.accessToken);
    await Promise.all([waitForConnect(socketA), waitForConnect(socketB)]);
    // The gateway joins room channels asynchronously after the handshake.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const clientMessageId = randomUUID();
    const incoming = waitFor(socketB, 'message:new');
    const firstAck = await sendMessage(socketA, {
      roomId: room.id,
      content: 'hello from the smoke test',
      clientMessageId,
    });
    assert.equal(firstAck.ok, true, JSON.stringify(firstAck));
    assert.equal(firstAck.data.content, 'hello from the smoke test');

    const received = await incoming;
    assert.equal(received.id, firstAck.data.id, 'receiver got the persisted message');
    assert.equal(received.clientMessageId, clientMessageId);

    // Retrying with the same clientMessageId must not create a duplicate.
    const retryAck = await sendMessage(socketA, {
      roomId: room.id,
      content: 'hello from the smoke test',
      clientMessageId,
    });
    assert.equal(retryAck.ok, true, JSON.stringify(retryAck));
    assert.equal(retryAck.data.id, firstAck.data.id, 'idempotent retry reuses the message id');

    const history = await request(`/rooms/${room.id}/messages?limit=10`, {
      token: bob.accessToken,
    });
    assert.ok(
      history.items.some((message) => message.id === firstAck.data.id),
      'history contains the sent message',
    );

    const typingEvent = waitForMatch(
      socketB,
      'typing:update',
      (update) => update.userId === alice.user.id && update.isTyping,
    );
    const typingAck = await emitAck(socketA, 'typing:start', { roomId: room.id });
    assert.equal(typingAck.ok, true, JSON.stringify(typingAck));
    const typingUpdate = await typingEvent;
    assert.equal(typingUpdate.username, alice.user.username);
    assert.equal(typingUpdate.isTyping, true);

    const stopEvent = waitForMatch(
      socketB,
      'typing:update',
      (update) => update.userId === alice.user.id && !update.isTyping,
    );
    await emitAck(socketA, 'typing:stop', { roomId: room.id });
    assert.equal((await stopEvent).isTyping, false);

    const readEvent = waitForMatch(
      socketA,
      'message:read',
      (receipt) => receipt.userId === bob.user.id && receipt.lastReadMessageId === firstAck.data.id,
    );
    const readAck = await emitAck(socketB, 'read:mark', {
      roomId: room.id,
      messageId: firstAck.data.id,
    });
    assert.equal(readAck.ok, true, JSON.stringify(readAck));
    const receipt = await readEvent;
    assert.equal(receipt.roomId, room.id);
    assert.equal(receipt.lastReadMessageId, firstAck.data.id);

    // Presence: Cara joins the room on an instance that already has Alice and Bob.
    const cara = await request('/auth/register', {
      method: 'POST',
      body: {
        email: `smoke-c-${suffix}@example.com`,
        username: `smoke_c_${suffix}`,
        password: 'Password123!',
      },
    });
    await request(`/rooms/${room.id}/join`, { method: 'POST', token: cara.accessToken });

    const onlineEvent = waitForMatch(
      socketA,
      'presence:update',
      (update) => update.userId === cara.user.id && update.status === 'online',
    );
    socketC = connect(cara.accessToken);
    const snapshotEvent = waitFor(socketC, 'presence:snapshot');
    await waitForConnect(socketC);
    const snapshot = await snapshotEvent;
    assert.ok(
      snapshot.users.some((user) => user.userId === alice.user.id && user.status === 'online'),
      'snapshot lists Alice as online',
    );
    assert.ok(
      snapshot.users.some((user) => user.userId === bob.user.id && user.status === 'online'),
      'snapshot lists Bob as online',
    );
    await onlineEvent;

    const offlineEvent = waitForMatch(
      socketA,
      'presence:update',
      (update) => update.userId === cara.user.id && update.status === 'offline',
    );
    socketC.disconnect();
    const offline = await offlineEvent;
    assert.ok(offline.lastSeenAt, 'offline presence includes lastSeenAt');

    const deletedEvent = waitFor(socketB, 'message:deleted');
    await request(`/messages/${firstAck.data.id}`, { method: 'DELETE', token: alice.accessToken });
    const deleted = await deletedEvent;
    assert.equal(deleted.messageId, firstAck.data.id, 'delete broadcast reached the other client');

    const muteEvent = waitForMatch(
      socketB,
      'room:member-muted',
      (payload) => payload.userId === bob.user.id && payload.mutedUntil !== null,
    );
    await request(`/rooms/${room.id}/members/${bob.user.id}/mute`, {
      method: 'POST',
      token: alice.accessToken,
      body: { durationSeconds: 120 },
    });
    await muteEvent;

    const mutedAck = await sendMessage(socketB, {
      roomId: room.id,
      content: 'this should be rejected',
      clientMessageId: randomUUID(),
    });
    assert.equal(mutedAck.ok, false, JSON.stringify(mutedAck));
    assert.equal(mutedAck.error.code, 'MUTED');

    await request(`/rooms/${room.id}/members/${bob.user.id}/mute`, {
      method: 'DELETE',
      token: alice.accessToken,
    });
    const unmutedAck = await sendMessage(socketB, {
      roomId: room.id,
      content: 'muted period is over',
      clientMessageId: randomUUID(),
    });
    assert.equal(unmutedAck.ok, true, JSON.stringify(unmutedAck));

    const kickEvent = waitForMatch(
      socketB,
      'room:member-removed',
      (payload) => payload.userId === bob.user.id && payload.reason === 'kicked',
    );
    await request(`/rooms/${room.id}/members/${bob.user.id}`, {
      method: 'DELETE',
      token: alice.accessToken,
    });
    await kickEvent;

    const kickedAck = await sendMessage(socketB, {
      roomId: room.id,
      content: 'kicked users cannot send',
      clientMessageId: randomUUID(),
    });
    assert.equal(kickedAck.ok, false, JSON.stringify(kickedAck));
    assert.equal(kickedAck.error.code, 'NOT_A_MEMBER');

    await request(`/rooms/${room.id}/join`, { method: 'POST', token: bob.accessToken });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const rejoinedAck = await sendMessage(socketB, {
      roomId: room.id,
      content: 'rejoined after a kick',
      clientMessageId: randomUUID(),
    });
    assert.equal(rejoinedAck.ok, true, JSON.stringify(rejoinedAck));

    const banEvent = waitForMatch(
      socketB,
      'room:member-removed',
      (payload) => payload.userId === bob.user.id && payload.reason === 'banned',
    );
    await request(`/rooms/${room.id}/bans`, {
      method: 'POST',
      token: alice.accessToken,
      body: { userId: bob.user.id, reason: 'smoke test ban' },
    });
    await banEvent;

    const bannedJoin = await api(`/rooms/${room.id}/join`, {
      method: 'POST',
      token: bob.accessToken,
    });
    assert.equal(bannedJoin.status, 403, JSON.stringify(bannedJoin.body));
    assert.equal(bannedJoin.body.error.code, 'BANNED');

    await request(`/rooms/${room.id}/bans/${bob.user.id}`, {
      method: 'DELETE',
      token: alice.accessToken,
    });
    await request(`/rooms/${room.id}/join`, { method: 'POST', token: bob.accessToken });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const unbannedAck = await sendMessage(socketB, {
      roomId: room.id,
      content: 'back after the ban',
      clientMessageId: randomUUID(),
    });
    assert.equal(unbannedAck.ok, true, JSON.stringify(unbannedAck));

    const unauthenticated = await api('/rooms');
    assert.equal(unauthenticated.status, 401, 'REST requires a bearer token');

    unauthenticatedSocket = io(WS_URL, {
      auth: { token: 'not-a-token' },
      transports: ['websocket'],
      reconnection: false,
      timeout: 5_000,
    });
    const connectError = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Expected connect_error')), 5_000);
      unauthenticatedSocket.once('connect_error', (error) => {
        clearTimeout(timer);
        resolve(error);
      });
    });
    assert.equal(connectError.message, 'UNAUTHORIZED', 'invalid handshake tokens are rejected');

    console.log('Smoke test passed:');
    console.log('  - REST auth, room create/join, history');
    console.log('  - socket handshake auth rejects bad tokens');
    console.log('  - message send ack + broadcast to a second client');
    console.log('  - idempotent retry with the same clientMessageId');
    console.log('  - delete broadcast');
    console.log('  - typing start/stop events');
    console.log('  - socket read receipts');
    console.log('  - presence snapshot, online, and offline events');
    console.log('  - mute/unmute, kick, ban/unban moderation');
  } finally {
    unauthenticatedSocket?.disconnect();
    socketC?.disconnect();
    socketA?.disconnect();
    socketB?.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
