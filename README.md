# Real-Time Chat App

A full-stack chat application: a NestJS REST + Socket.IO backend and a React client with
virtualized history, optimistic sending, and reconnect catch-up. Message fan-out is shared
through Redis, so multiple API instances behave like one server.

```
backend/   NestJS API, Prisma schema, Socket.IO gateway, smoke tests
frontend/  Vite + React + TypeScript client (Tailwind, TanStack Query, Zustand)
```

## What is implemented

### Backend

- Email/password auth with Argon2 hashing and short-lived JWT access tokens.
- Opaque refresh tokens in an `httpOnly` cookie, with rotation and reuse detection.
- Public, private, and direct rooms; owner/member roles; membership checks.
- Message send (socket + REST fallback), cursor-paginated history, soft delete, read pointer.
- Idempotent message creation via a client-generated `clientMessageId`.
- Typing indicators and live read receipts over sockets.
- Redis-backed presence snapshots and online/offline updates.
- Owner-only moderation: kick, mute/unmute, and ban/unban.
- Socket handshake authentication and a typed acknowledgement contract.
- Redis-backed Socket.IO adapter for cross-instance delivery (no sticky sessions needed).
- Health checks for Postgres and Redis, Swagger docs, structured error codes.
- Unit tests for room policy and cursor helpers; smoke tests for REST + WebSockets.

### Frontend (MVP phases 0–4)

- Vite + React 19 + TypeScript strict, Tailwind CSS v4 design tokens with light/dark themes.
- App shell with a responsive sidebar, room list, unread badges, search, and empty states.
- Login/register with React Hook Form + Zod, in-memory access token, silent refresh on boot.
- Room list, create public/private rooms, explore/join public rooms, and start direct messages.
- Virtualized message history (`react-virtuoso`) with reverse infinite scroll.
- Composer with Enter-to-send, Shift+Enter newline, auto-growing textarea, and draft retention.
- Optimistic send over Socket.IO, REST fallback while offline, retry on failure, and
  deduplication by `clientMessageId`.
- Socket event bridge that keeps TanStack Query caches in sync (`message:new`,
  `message:deleted`, membership events).
- Reconnect catch-up: fetches `GET /rooms/:id/messages?after=<newestId>` and merges missed
  messages, plus a connection banner while reconnecting.
- Read-pointer updates that clear unread counts while the room is focused and at the bottom.
- Route guards, 404 page, loading skeletons, and error states.

Deferred to the next milestone: typing/presence UI, read-receipt display, moderation UI,
GSAP motion, and the production web container.

## Stack

| Layer      | Choice                                             |
| ---------- | -------------------------------------------------- |
| Runtime    | Node.js 22+ (developed on Node 24)                 |
| Backend    | NestJS 11, Prisma 6, PostgreSQL 17, Redis 7        |
| Realtime   | Socket.IO 4.8 (WebSocket transport only)           |
| Auth       | `@nestjs/jwt`, Argon2, refresh cookies             |
| Frontend   | Vite 7, React 19, TypeScript 5.9                   |
| Data       | TanStack Query 5, Zustand 5                        |
| UI         | Tailwind CSS v4, React Router 7, React Virtuoso    |
| Forms      | React Hook Form 7 + Zod 4                          |
| Testing    | Jest (backend), Vitest + Testing Library (frontend)|
| Tooling    | pnpm workspace, ESLint 9                           |

## Repository layout

```
.
├── backend/
│   ├── prisma/                 schema, migrations, seed
│   ├── scripts/                smoke.mjs, smoke-multi-instance.mjs
│   ├── src/
│   │   ├── auth/               register, login, refresh, logout
│   │   ├── users/              profile and user search
│   │   ├── rooms/              rooms, membership, pure authorization policy
│   │   ├── messages/           persistence, pagination, delete, read pointer
│   │   ├── chat/               gateway, events, presence, auth middleware, Redis adapter
│   │   ├── common/             errors, guards, pagination, shared types
│   │   ├── config/             env validation and typed configuration
│   │   ├── database/           Prisma module/service
│   │   ├── health/             Terminus health endpoint
│   │   └── redis/              shared Redis client
│   └── .env.example
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/                router, guards, app shell, splash
│   │   ├── components/         UI primitives, icons, logo, theme toggle
│   │   ├── features/
│   │   │   ├── auth/           API, login/register, logout, user menu
│   │   │   ├── chat/           chat view, Virtuoso list, composer, send/catch-up hooks
│   │   │   ├── rooms/          room list, create room, explore, DM dialog
│   │   │   └── users/          user search API
│   │   ├── lib/                API client, query keys/cache helpers, socket bridge, utils
│   │   ├── stores/             auth, connection, pending messages, UI, toasts
│   │   └── test/               Vitest setup
│   └── .env.example
├── .github/workflows/ci.yml
├── docker-compose.yml          local Postgres + Redis
├── package.json                workspace scripts
└── pnpm-workspace.yaml         backend, frontend, packages/*
```

The backend is a **modular monolith**: modules communicate through services, not network
calls. `RealtimeService` is the only component that talks to the Socket.IO server, which
keeps HTTP and WebSocket paths consistent.

The frontend keeps server data in TanStack Query and ephemeral state (session, connection,
pending sends) in Zustand. Socket events are translated into query-cache updates by a single
`SocketBridge`, so REST and realtime paths never produce two competing stores.

## Getting started

Prerequisites: Node.js 22+, pnpm 12+, Docker.

```bash
pnpm install
docker compose up -d        # Postgres :5432, Redis :6379

cp backend/.env.example backend/.env
# edit JWT_ACCESS_SECRET; generate one with:
# node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Run the two apps in separate terminals:

```bash
pnpm dev        # backend  -> http://localhost:3000 (Swagger at /docs, health at /health)
pnpm dev:web    # frontend -> http://localhost:5173
```

The Vite dev server proxies `/api` and `/socket.io` to the backend, so refresh cookies stay
same-origin and no CORS configuration is needed in development. If the backend runs on a
different port, create `frontend/.env.local`:

```bash
VITE_API_PROXY_TARGET=http://localhost:3100
```

and start the backend with `PORT=3100` (on Windows PowerShell: `$env:PORT=3100; pnpm dev`).

### Demo data

`pnpm db:seed` creates `alice`, `bob`, and `cara` (password `Password123!`) and a public
room named `general`.

| Email               | Username |
| ------------------- | -------- |
| `alice@example.com` | alice    |
| `bob@example.com`   | bob      |
| `cara@example.com`  | cara     |

The login screen includes a **Fill** shortcut for the demo account.

### Environment variables

Backend (`backend/.env`):

| Variable            | Required | Default                 | Purpose                                         |
| ------------------- | -------- | ----------------------- | ----------------------------------------------- |
| `NODE_ENV`          | no       | `development`           | `development`, `production`, or `test`          |
| `PORT`              | no       | `3000`                  | HTTP + WebSocket port                           |
| `DATABASE_URL`      | yes      | —                       | PostgreSQL connection string                    |
| `REDIS_URL`         | yes      | —                       | Redis connection string                         |
| `JWT_ACCESS_SECRET` | yes      | —                       | Access-token signing key (min 32 chars)         |
| `JWT_ACCESS_TTL`    | no       | `900`                   | Access-token lifetime in seconds                |
| `REFRESH_TTL`       | no       | `2592000`               | Refresh-token lifetime in seconds (30 days)     |
| `COOKIE_SECURE`     | no       | true in production      | Set the refresh cookie's `Secure` flag          |
| `CORS_ORIGINS`      | no       | `http://localhost:5173` | Comma-separated browser origins for REST and WS |

Frontend (`frontend/.env.local`, optional):

| Variable                | Default                 | Purpose                             |
| ----------------------- | ----------------------- | ----------------------------------- |
| `VITE_API_PROXY_TARGET` | `http://localhost:3000` | Vite proxy target for `/api` + WS   |

## REST API

All routes except `POST /api/auth/register` and `POST /api/auth/login` require
`Authorization: Bearer <accessToken>`. Errors use:

```json
{ "error": { "code": "FORBIDDEN", "message": "..." } }
```

Validation errors may also include a `details` array.

| Method | Path                                      | Description                                    |
| ------ | ----------------------------------------- | ---------------------------------------------- |
| POST   | `/api/auth/register`                      | Create account; sets refresh cookie            |
| POST   | `/api/auth/login`                         | Log in; sets refresh cookie                    |
| POST   | `/api/auth/refresh`                       | Rotate refresh token; returns new access token |
| POST   | `/api/auth/logout`                        | Revoke the presented refresh token             |
| GET    | `/api/users/me`                           | Current profile                                |
| PATCH  | `/api/users/me`                           | Update username/avatar                         |
| GET    | `/api/users?search=`                      | Search users (excludes the caller)             |
| POST   | `/api/rooms`                              | Create a public/private room                   |
| GET    | `/api/rooms`                              | List the caller's rooms with unread counts     |
| GET    | `/api/rooms/public?cursor=&limit=`        | Browse public rooms                            |
| POST   | `/api/rooms/direct`                       | Get or create a direct room with a user        |
| POST   | `/api/rooms/:roomId/join`                 | Join a public room                             |
| POST   | `/api/rooms/:roomId/leave`                | Leave a room (owner cannot leave)              |
| POST   | `/api/rooms/:roomId/members`              | Owner invites users                            |
| GET    | `/api/rooms/:roomId/members`              | List members                                   |
| DELETE | `/api/rooms/:roomId/members/:userId`      | Kick a member (owner only)                     |
| POST   | `/api/rooms/:roomId/members/:userId/mute` | Mute a member for `durationSeconds`            |
| DELETE | `/api/rooms/:roomId/members/:userId/mute` | Clear a mute                                   |
| POST   | `/api/rooms/:roomId/bans`                 | Ban a user, optionally for `durationSeconds`   |
| DELETE | `/api/rooms/:roomId/bans/:userId`         | Lift a ban                                     |
| GET    | `/api/rooms/:roomId`                      | Room detail (members only, or public room)     |
| POST   | `/api/rooms/:roomId/messages`             | Send a message over REST                       |
| GET    | `/api/rooms/:roomId/messages`             | History: `before`, `after`, `limit` (1–100)    |
| DELETE | `/api/messages/:messageId`                | Soft-delete own message (or as room owner)     |
| POST   | `/api/rooms/:roomId/read`                 | Move the read pointer to a message id          |

Pagination responses are `{ "items": [...], "nextCursor": "..." }`. Message history
is newest-first with `before` and oldest-first with `after`; cursors are message ids.

## WebSocket contract

Connect to the same origin with the access token in the handshake `auth` object (never in
the URL):

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { token: accessToken },
  transports: ['websocket'],
});
```

The server rejects missing, invalid, or expired handshake tokens with
`connect_error` / `UNAUTHORIZED`. On connect it joins the socket to every room the user
belongs to (up to 200), so clients do not need to request room subscriptions.

### Client → server

| Event          | Payload                                | Ack                  |
| -------------- | -------------------------------------- | -------------------- |
| `message:send` | `{ roomId, content, clientMessageId }` | `Ack<MessageDto>`    |
| `typing:start` | `{ roomId }`                           | `Ack<TypingUpdate>`  |
| `typing:stop`  | `{ roomId }`                           | `Ack<TypingUpdate>`  |
| `read:mark`    | `{ roomId, messageId }`                | `Ack<ReadReceipt>`   |

`content` is 1–4000 characters after trimming. `clientMessageId` is 8–64 characters and
must be stable across retries. Typing and read events require membership in `roomId`.
Typing state is never persisted: clients should send `typing:start` on input and
`typing:stop` after a few seconds of inactivity, and treat any missing `typing:stop`
as expired. `read:mark` only moves the pointer forward and broadcasts `message:read`.
Ack shape:

```ts
type Ack<T> = { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string } };
```

Example:

```js
socket
  .timeout(5000)
  .emit(
    'message:send',
    { roomId, content: 'hello', clientMessageId: crypto.randomUUID() },
    (timeoutError, ack) => {
      if (timeoutError) return;
      if (ack.ok) console.log(ack.data.id);
      else console.warn(ack.error.code, ack.error.message);
    },
  );
```

### Server → client

| Event                 | Payload                                    | When                                      |
| --------------------- | ------------------------------------------ | ----------------------------------------- |
| `message:new`         | `MessageDto`                               | A message is created in a joined room     |
| `message:deleted`     | `{ roomId, messageId }`                    | A message is soft-deleted                 |
| `message:read`        | `{ roomId, userId, lastReadMessageId }`    | A read pointer moves (socket or REST)     |
| `typing:update`       | `{ roomId, userId, username, isTyping }`   | A member starts or stops typing           |
| `presence:snapshot`   | `{ users: PresenceEntry[] }`               | Once, right after the socket connects     |
| `presence:update`     | `{ userId, status, lastSeenAt }`           | A peer in a shared room goes on/offline   |
| `room:member-joined`  | `{ roomId, userId }`                       | A user joins a room                       |
| `room:member-left`    | `{ roomId, userId }`                       | A user leaves a room                      |
| `room:member-removed` | `{ roomId, userId, reason }`               | A member is kicked or banned              |
| `room:member-muted`   | `{ roomId, userId, mutedUntil }`           | A mute is applied or cleared              |
| `auth:expired`        | —                                          | An event arrives after token `exp`        |

```ts
interface PresenceEntry {
  userId: string;
  status: 'online' | 'offline';
  lastSeenAt: string | null; // set when status is offline
}
```

`presence:snapshot` lists only users who share at least one room with the caller (capped
at 500), not every connected user. `presence:update` is broadcast to each shared room.
Presence uses a per-user connection counter in Redis, so multiple tabs collapse into one
online/offline transition without a database query per event. The counter is decremented
on a graceful disconnect; an instance that crashes can leave a stale `online` value until
that user reconnects, which clients should treat as best-effort.

`room:member-removed` and `room:member-muted` are owner-only actions and are rejected in
direct rooms. A removed member's socket leaves the room immediately; the event is sent to
the target's `user:<id>` channel as well as the room.

When `auth:expired` fires, the client refreshes the access token and reconnects. Because the
adapter uses classic Redis pub/sub, Socket.IO connection-state recovery is disabled; after a
reconnect, the frontend fetches missed messages with
`GET /api/rooms/:roomId/messages?after=<lastMessageId>`.

## Frontend architecture

### Session

The access token is kept **in memory** in a Zustand store. The refresh token is an
`httpOnly` cookie scoped to `/api/auth`. On boot the app calls `POST /api/auth/refresh`:

- success → session restored, router renders the authenticated shell;
- failure → the app renders `/login`.

Every API 401 triggers a **single-flight** refresh and one retry. Socket reconnects take a
fresh token from the same store through Socket.IO's `auth` callback.

### Realtime bridge

One socket per session. `SocketBridge` listens for server events and updates the query
cache:

- `message:new` → `upsertMessage` (dedupe by id and `clientMessageId`), bump the room to the
  top, increment unread when the room is not focused;
- `message:deleted` → remove from the message cache and update the room preview;
- `room:member-removed` → drop the room, clear caches, toast, and navigate away;
- membership changes → invalidate room details and the room list;
- `connect` → mark online, invalidate the room list, and let the chat view catch up.

### Sending

1. A pending message is added to a Zustand store with a `clientMessageId`.
2. The composer clears immediately.
3. Connected: `socket.timeout(5000).emit('message:send', ...)`. Offline: the REST fallback
   `POST /rooms/:id/messages` is used.
4. The ack, broadcast, or REST response reconciles the pending row by `clientMessageId`.
5. Failure marks the row with **Retry**; retrying reuses the same `clientMessageId`, so the
   server's unique constraint makes it safe.

### History and reconnect

- History is an infinite TanStack Query (`newest-first` pages via `before`).
- Messages are flattened to chronological order and rendered in Virtuoso.
- Older pages are prepended; Virtuoso's `firstItemIndex` keeps the scroll anchored.
- Live messages append to the newest page; the list sticks to the bottom only when the user
  is already there, otherwise a **“N new messages”** pill appears.
- On reconnect, the chat view fetches `after=<newestId>`, follows `nextCursor`, and merges
  the result without duplicates.
- Read pointers are advanced at most once per message id, and only while the window is
  focused and the list is at the bottom.

### Cache helpers

Pure functions in `frontend/src/lib/query/messages.ts` own the tricky parts and are unit
tested: optimistic reconciliation, catch-up merging, room reordering, unread increments,
deleted previews, and read-pointer updates.

## Verification

Run from the repository root:

```bash
pnpm typecheck     # backend + frontend
pnpm lint          # backend + frontend
pnpm test          # Jest (18) + Vitest (15)
pnpm build         # Nest build + Vite build
```

Individual apps:

```bash
pnpm typecheck:api / lint:api / test:api / build:api
pnpm typecheck:web / lint:web / test:web / build:web
```

With the API running on port 3000:

```bash
pnpm smoke         # single-instance REST + WebSocket smoke test
```

The smoke test covers registration, room creation/join, socket auth, message ack +
broadcast, idempotent retry, history, delete broadcast, typing start/stop, socket read
receipts, presence snapshot/online/offline, and mute, kick, and ban flows.

For cross-instance delivery, start two instances against the same Postgres and Redis:

```powershell
# terminal 1
cd backend; $env:PORT=3100; node dist/main.js

# terminal 2
cd backend; $env:PORT=3101; node dist/main.js

# terminal 3, from the repo root
$env:API_URL='http://localhost:3100/api'; $env:WS_B='http://localhost:3101'; pnpm smoke:multi
```

`smoke:multi` registers two users, connects them to different instances, and asserts that
`message:new`, `typing:update`, and `presence:snapshot`/`presence:update` all cross the
Redis adapter.

## Design notes

- **UUIDv7 ids.** Ids are generated by the app and double as time-sortable cursors,
  avoiding a separate sequence and keeping message pagination index-friendly.
- **Refresh-token rotation.** The cookie contains `id.secret`; only an Argon2 hash of
  `secret` is stored. Reusing a rotated token revokes every session for that user.
- **Idempotent sends.** `(senderId, clientMessageId)` is unique. A retry returns the
  existing message, and reusing an id in a different room is a conflict.
- **Authorization in one place.** `RoomPolicyService` is pure and unit-tested; services
  resolve membership from the database and never trust client-supplied roles.
- **WebSocket-only transport.** No long-polling fallback means no sticky sessions are
  required behind a load balancer.
- **Redis adapter.** Every instance publishes to Redis and subscribes to room channels,
  so emissions reach clients on other instances. Health checks cover Redis separately.
- **Persist, then broadcast.** The database is the truth. If a broadcast is lost, the
  client recovers with `after=<lastId>` on reconnect.
- **One realtime writer.** The frontend never mutates the query cache from multiple
  components; `SocketBridge` plus the send hook own reconciliation.
- **Presence without polling.** Connection counts live in Redis hashes (`HINCRBY`), and
  a snapshot resolves peers from shared rooms in one query. Normal presence traffic
  never touches Postgres.
- **Moderation reuses the schema.** `RoomBan` and `RoomMember.mutedUntil` already modeled
  these states; bans support expiry and mutes are enforced in `MessagesService.create`.

## Not in this milestone

- Frontend typing/presence indicators, read-receipt display, and moderation UI.
- GSAP motion pass and mobile swipe transitions.
- Attachments/upload storage, message editing, reactions, mentions, notifications.
- Rate limiting, per-IP throttling, and audit logging.
- Search over message bodies and full-text indexes.
- Docker images/nginx for the frontend and backend, load testing, and metrics.

Ban rows are retained after they expire; `expiresAt` is checked at join time, and mutes
are enforced when a message is created.
