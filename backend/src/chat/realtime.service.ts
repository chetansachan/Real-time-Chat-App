import { Injectable, Logger } from '@nestjs/common';
import { roomChannel, userChannel, type ChatServer, type ServerToClientEvents } from './events';

type EmitArgs<E extends keyof ServerToClientEvents> = Parameters<ServerToClientEvents[E]>;

/**
 * The only place that talks to the Socket.IO server. Services and REST
 * controllers depend on this wrapper instead of reaching into gateway internals.
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: ChatServer | null = null;

  bind(server: ChatServer): void {
    this.server = server;
  }

  emitToRoom<E extends keyof ServerToClientEvents>(
    roomId: string,
    event: E,
    ...args: EmitArgs<E>
  ): void {
    if (!this.server) {
      this.logger.warn(`Dropped ${String(event)} for room ${roomId}: gateway not initialised`);
      return;
    }
    this.server.to(roomChannel(roomId)).emit(event, ...args);
  }

  emitToRoomExceptUser<E extends keyof ServerToClientEvents>(
    roomId: string,
    userId: string,
    event: E,
    ...args: EmitArgs<E>
  ): void {
    if (!this.server) {
      this.logger.warn(`Dropped ${String(event)} for room ${roomId}: gateway not initialised`);
      return;
    }
    this.server
      .to(roomChannel(roomId))
      .except(userChannel(userId))
      .emit(event, ...args);
  }

  emitToUser<E extends keyof ServerToClientEvents>(
    userId: string,
    event: E,
    ...args: EmitArgs<E>
  ): void {
    if (!this.server) {
      this.logger.warn(`Dropped ${String(event)} for user ${userId}: gateway not initialised`);
      return;
    }
    this.server.to(userChannel(userId)).emit(event, ...args);
  }

  /** Join every live socket of a user to a room channel (works across instances via Redis). */
  joinRoomForUser(userId: string, roomId: string): void {
    this.server?.in(userChannel(userId)).socketsJoin(roomChannel(roomId));
  }

  leaveRoomForUser(userId: string, roomId: string): void {
    this.server?.in(userChannel(userId)).socketsLeave(roomChannel(roomId));
  }
}
