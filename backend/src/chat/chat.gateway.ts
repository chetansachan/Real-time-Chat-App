import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from '@nestjs/websockets';
import { WsException } from '@nestjs/websockets';
import { AppError } from '../common/errors/app-error';
import type { Ack } from '../common/types/ack';
import type { SocketUser } from '../common/types/auth-user';
import { ErrorCodes } from '../common/types/error-codes';
import { MessagesService } from '../messages/messages.service';
import type { MessageDto } from '../messages/message.types';
import { SendMessageDto } from '../messages/dto/send-message.dto';
import { MembershipService } from '../rooms/membership.service';
import { ReadReceiptDto } from './dto/read-receipt.dto';
import { TypingDto } from './dto/typing.dto';
import {
  roomChannel,
  userChannel,
  type ChatServer,
  type ChatSocket,
  type ReadReceipt,
  type TypingUpdate,
} from './events';
import { PresenceService } from './presence.service';
import { RealtimeService } from './realtime.service';
import { toAckFailure } from './ws-ack.util';
import { WsAuthMiddleware } from './ws-auth.middleware';
import { WsValidationPipe } from './ws-validation.pipe';

@WebSocketGateway()
export class ChatGateway
  implements
    OnGatewayInit<ChatServer>,
    OnGatewayConnection<ChatSocket>,
    OnGatewayDisconnect<ChatSocket>
{
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly wsAuth: WsAuthMiddleware,
    private readonly realtime: RealtimeService,
    private readonly messages: MessagesService,
    private readonly membership: MembershipService,
    private readonly presence: PresenceService,
    private readonly config: ConfigService,
  ) {}

  afterInit(server: ChatServer): void {
    server.use((socket, next) => {
      void this.wsAuth.authenticate(socket, next);
    });
    this.realtime.bind(server);
    this.logger.log('Socket.IO gateway initialised');
  }

  async handleConnection(socket: ChatSocket): Promise<void> {
    const user = socket.data.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    try {
      await socket.join(userChannel(user.id));
      const maxRooms = this.config.getOrThrow<number>('chat.maxRoomsPerSocket');
      const roomIds = await this.membership.listRoomIdsForUser(user.id, maxRooms);
      if (roomIds.length > 0) {
        await socket.join(roomIds.map(roomChannel));
      }

      await this.presence.markOnline(user.id, roomIds);
      socket.emit('presence:snapshot', await this.presence.snapshotFor(user.id));

      this.logger.debug(`socket ${socket.id} connected (user ${user.id}, ${roomIds.length} rooms)`);
    } catch (error) {
      // Still allow the connection: the client can use REST while this is fixed.
      this.logger.error(
        `Failed to initialise socket ${socket.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async handleDisconnect(socket: ChatSocket): Promise<void> {
    const user = socket.data.user;
    if (!user) {
      return;
    }

    try {
      const maxRooms = this.config.getOrThrow<number>('chat.maxRoomsPerSocket');
      const roomIds = await this.membership.listRoomIdsForUser(user.id, maxRooms);
      await this.presence.markOffline(user.id, roomIds);
    } catch (error) {
      this.logger.error(
        `Failed to clean up socket ${socket.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  @SubscribeMessage('message:send')
  async onMessageSend(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody(new WsValidationPipe()) dto: SendMessageDto,
  ): Promise<Ack<MessageDto>> {
    try {
      const user = this.requireFreshUser(socket);
      const message = await this.messages.create(user.id, dto.roomId, dto);
      this.realtime.emitToRoom(dto.roomId, 'message:new', message);
      return { ok: true, data: message };
    } catch (error) {
      if (!(error instanceof AppError) && !(error instanceof WsException)) {
        this.logger.error(
          `message:send failed for socket ${socket.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
      return toAckFailure(error);
    }
  }

  @SubscribeMessage('typing:start')
  onTypingStart(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody(new WsValidationPipe()) dto: TypingDto,
  ): Promise<Ack<TypingUpdate>> {
    return this.handleTyping(socket, dto, true);
  }

  @SubscribeMessage('typing:stop')
  onTypingStop(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody(new WsValidationPipe()) dto: TypingDto,
  ): Promise<Ack<TypingUpdate>> {
    return this.handleTyping(socket, dto, false);
  }

  @SubscribeMessage('read:mark')
  async onReadMark(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody(new WsValidationPipe()) dto: ReadReceiptDto,
  ): Promise<Ack<ReadReceipt>> {
    try {
      const user = this.requireFreshUser(socket);
      const result = await this.messages.markRead(dto.roomId, user.id, dto.messageId);
      const receipt: ReadReceipt = {
        roomId: dto.roomId,
        userId: user.id,
        lastReadMessageId: result.lastReadMessageId ?? dto.messageId,
      };
      this.realtime.emitToRoom(dto.roomId, 'message:read', receipt);
      return { ok: true, data: receipt };
    } catch (error) {
      this.logSocketFailure('read:mark', socket, error);
      return toAckFailure(error);
    }
  }

  private async handleTyping(
    socket: ChatSocket,
    dto: TypingDto,
    isTyping: boolean,
  ): Promise<Ack<TypingUpdate>> {
    try {
      const user = this.requireFreshUser(socket);
      await this.membership.assertMember(dto.roomId, user.id);
      const update: TypingUpdate = {
        roomId: dto.roomId,
        userId: user.id,
        username: user.username,
        isTyping,
      };
      socket.to(roomChannel(dto.roomId)).emit('typing:update', update);
      return { ok: true, data: update };
    } catch (error) {
      this.logSocketFailure('typing', socket, error);
      return toAckFailure(error);
    }
  }

  private logSocketFailure(event: string, socket: ChatSocket, error: unknown): void {
    if (!(error instanceof AppError) && !(error instanceof WsException)) {
      this.logger.error(
        `${event} failed for socket ${socket.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Sockets outlive 15-minute access tokens; reject events once `exp` passes. */
  private requireFreshUser(socket: ChatSocket): SocketUser {
    const user = socket.data.user;
    if (!user || user.exp * 1_000 <= Date.now()) {
      socket.emit('auth:expired');
      throw new AppError(
        ErrorCodes.TOKEN_EXPIRED,
        'Access token expired; refresh and reconnect',
        401,
      );
    }
    return user;
  }
}
