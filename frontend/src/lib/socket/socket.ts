import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth';
import type { ClientToServerEvents, ServerToClientEvents } from './events';

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Same-origin connection: Vite proxies `/socket.io` in dev, nginx in production.
 * `auth` is a callback so every (re)connect picks up the current access token.
 */
export const socket: ChatSocket = io({
  autoConnect: false,
  transports: ['websocket'],
  auth: (cb) => cb({ token: useAuthStore.getState().accessToken ?? '' }),
  reconnection: true,
  reconnectionDelay: 800,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.4,
});
