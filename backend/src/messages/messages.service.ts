import { Injectable } from '@nestjs/common';
import { MessageType, Prisma } from '@prisma/client';
import { uuidv7 } from 'uuidv7';
import { isUniqueConstraintError } from '../common/db/prisma-errors';
import { AppError } from '../common/errors/app-error';
import { isNewerThan, toPage, type Page } from '../common/pagination/cursor';
import { ErrorCodes } from '../common/types/error-codes';
import { PrismaService } from '../database/prisma.service';
import { MembershipService } from '../rooms/membership.service';
import { RoomPolicyService } from '../rooms/room-policy.service';
import type { CreateMessageDto } from './dto/create-message.dto';
import type { ListMessagesDto } from './dto/list-messages.dto';
import { messageWithSenderInclude, toMessageDto } from './message.mapper';
import type { MessageDto } from './message.types';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly policy: RoomPolicyService,
  ) {}

  /**
   * Persist-then-broadcast: callers emit `message:new` after this resolves.
   * Idempotent on (senderId, clientMessageId), so client retries are safe.
   */
  async create(senderId: string, roomId: string, dto: CreateMessageDto): Promise<MessageDto> {
    const membership = await this.membership.assertMember(roomId, senderId);
    if (membership.mutedUntil && membership.mutedUntil.getTime() > Date.now()) {
      throw new AppError(
        ErrorCodes.MUTED,
        `You are muted until ${membership.mutedUntil.toISOString()}`,
        403,
      );
    }

    const content = dto.content.trim();
    if (content.length === 0) {
      throw new AppError(ErrorCodes.VALIDATION, 'Message content is required', 400);
    }

    const existing = await this.prisma.message.findUnique({
      where: {
        senderId_clientMessageId: { senderId, clientMessageId: dto.clientMessageId },
      },
      include: messageWithSenderInclude,
    });
    if (existing) {
      if (existing.roomId !== roomId) {
        throw new AppError(
          ErrorCodes.CONFLICT,
          'clientMessageId was already used in another room',
          409,
        );
      }
      return toMessageDto(existing);
    }

    try {
      const message = await this.prisma.$transaction(async (tx) => {
        const created = await tx.message.create({
          data: {
            id: uuidv7(),
            roomId,
            senderId,
            content,
            type: MessageType.TEXT,
            clientMessageId: dto.clientMessageId,
          },
          include: messageWithSenderInclude,
        });
        await tx.room.update({
          where: { id: roomId },
          data: { lastMessageAt: created.createdAt },
        });
        return created;
      });
      return toMessageDto(message);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const raced = await this.prisma.message.findUnique({
          where: {
            senderId_clientMessageId: { senderId, clientMessageId: dto.clientMessageId },
          },
          include: messageWithSenderInclude,
        });
        if (raced) {
          return toMessageDto(raced);
        }
      }
      throw error;
    }
  }

  async list(roomId: string, userId: string, query: ListMessagesDto): Promise<Page<MessageDto>> {
    await this.membership.assertMember(roomId, userId);
    if (query.before && query.after) {
      throw new AppError(ErrorCodes.VALIDATION, 'Use either `before` or `after`, not both', 400);
    }

    const limit = query.limit ?? 30;
    const where: Prisma.MessageWhereInput = { roomId, deletedAt: null };
    let orderBy: Prisma.MessageOrderByWithRelationInput = { id: 'desc' };

    if (query.before) {
      where.id = { lt: query.before };
    } else if (query.after) {
      where.id = { gt: query.after };
      orderBy = { id: 'asc' };
    }

    const rows = await this.prisma.message.findMany({
      where,
      orderBy,
      take: limit + 1,
      include: messageWithSenderInclude,
    });
    const page = toPage(rows, limit);
    return { items: page.items.map(toMessageDto), nextCursor: page.nextCursor };
  }

  async deleteMessage(messageId: string, actorId: string): Promise<MessageDto> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, roomId: true, senderId: true, deletedAt: true },
    });
    if (!message || message.deletedAt) {
      throw new AppError(ErrorCodes.MESSAGE_NOT_FOUND, 'Message not found', 404);
    }

    const membership = await this.membership.assertMember(message.roomId, actorId);
    if (!this.policy.canDeleteMessage(actorId, message.senderId, membership.role)) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'You cannot delete this message', 403);
    }

    const deleted = await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
      include: messageWithSenderInclude,
    });
    return toMessageDto(deleted);
  }

  async markRead(
    roomId: string,
    userId: string,
    messageId: string,
  ): Promise<{ roomId: string; lastReadMessageId: string | null }> {
    const membership = await this.membership.assertMember(roomId, userId);
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, roomId },
      select: { id: true },
    });
    if (!message) {
      throw new AppError(ErrorCodes.MESSAGE_NOT_FOUND, 'Message not found', 404);
    }

    if (isNewerThan(messageId, membership.lastReadMessageId)) {
      await this.prisma.roomMember.update({
        where: { roomId_userId: { roomId, userId } },
        data: { lastReadMessageId: messageId },
      });
      return { roomId, lastReadMessageId: messageId };
    }

    return { roomId, lastReadMessageId: membership.lastReadMessageId };
  }
}
