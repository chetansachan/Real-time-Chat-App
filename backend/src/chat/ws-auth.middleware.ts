import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../common/types/jwt-payload';
import type { ChatSocket } from './events';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Authenticates the handshake before the socket is allowed to connect.
 * The access token travels in `handshake.auth`, never in the URL.
 */
@Injectable()
export class WsAuthMiddleware {
  constructor(private readonly jwt: JwtService) {}

  async authenticate(socket: ChatSocket, next: (error?: Error) => void): Promise<void> {
    const auth: unknown = socket.handshake.auth;
    const token = isRecord(auth) ? auth.token : undefined;

    if (typeof token !== 'string' || token.length === 0) {
      next(new Error('UNAUTHORIZED'));
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      if (!payload.sub || !payload.username) {
        throw new Error('Token payload is missing required claims');
      }
      socket.data.user = {
        id: payload.sub,
        username: payload.username,
        exp: payload.exp ?? 0,
      };
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  }
}
