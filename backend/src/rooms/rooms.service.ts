import { Injectable } from '@nestjs/common';
import { MemberRole, RoomType } from '@prisma/client';
import { uuidv7 } from 'uuidv7';
import { isUniqueConstraintError } from '../common/db/prisma-errors';
import { AppError } from '../common/errors/app-error';
import { toPage, type Page } from '../common/pagination/cursor';
import { ErrorCodes } from '../common/types/error-codes';
import { PrismaService } from '../database/prisma.service';
import { RealtimeService } from '../chat/realtime.service';
import type { CreateDirectRoomDto } from './dto/create-direct-room.dto';
import type { CreateRoomDto } from './dto/create-room.dto';
import type { ListPublicRoomsDto } from './dto/list-public-rooms.dto';
import { MembershipService } from './membership.service';
import {
  roomDetailInclude,
  roomWithLastMessageInclude,
  toPublicRoomSummary,
  toRoomDetail,
  toRoomSummary,
} from './room.mapper';
import type { PublicRoomSummary, RoomDetail, RoomSummary } from './rooms.types';
import { toUserPreview, userPreviewSelect, type UserPreview } from '../users/user.mapper';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly realtime: RealtimeService,
  ) {}

  async create(actorId: string, dto: CreateRoomDto): Promise<RoomSummary> {
    if (dto.type === RoomType.DIRECT) {
      throw new AppError(ErrorCodes.VALIDATION, 'Use POST /rooms/direct to create a DM', 400);
    }
    const name = dto.name?.trim() ?? '';
    if (dto.type === RoomType.PUBLIC && name.length === 0) {
      throw new AppError(ErrorCodes.VALIDATION, 'Public rooms require a name', 400);
    }

    const memberIds = [...new Set(dto.memberIds ?? [])].filter((userId) => userId !== actorId);
    await this.membership.ensureUsersExist(memberIds);

    const room = await this.prisma.room.create({
      data: {
        id: uuidv7(),
        type: dto.type,
        name: name.length > 0 ? name : null,
        ownerId: actorId,
        members: {
          create: [
            { userId: actorId, role: MemberRole.OWNER },
            ...memberIds.map((userId) => ({ userId })),
          ],
        },
      },
    });

    this.realtime.joinRoomForUser(actorId, room.id);
    for (const userId of memberIds) {
      this.realtime.joinRoomForUser(userId, room.id);
      this.realtime.emitToRoom(room.id, 'room:member-joined', { roomId: room.id, userId });
    }

    return this.getSummary(room.id, actorId);
  }

  async direct(actorId: string, dto: CreateDirectRoomDto): Promise<RoomSummary> {
    if (actorId === dto.userId) {
      throw new AppError(ErrorCodes.VALIDATION, 'Cannot create a DM with yourself', 400);
    }
    await this.membership.ensureUsersExist([dto.userId]);

    const directKey = [actorId, dto.userId].sort().join(':');
    const existing = await this.prisma.room.findUnique({ where: { directKey } });
    if (existing) {
      return this.getSummary(existing.id, actorId);
    }

    try {
      const room = await this.prisma.room.create({
        data: {
          id: uuidv7(),
          type: RoomType.DIRECT,
          directKey,
          members: {
            create: [{ userId: actorId }, { userId: dto.userId }],
          },
        },
      });
      this.realtime.joinRoomForUser(actorId, room.id);
      this.realtime.joinRoomForUser(dto.userId, room.id);
      return this.getSummary(room.id, actorId);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const raced = await this.prisma.room.findUnique({ where: { directKey } });
        if (raced) {
          return this.getSummary(raced.id, actorId);
        }
      }
      throw error;
    }
  }

  async listMine(userId: string): Promise<RoomSummary[]> {
    const memberships = await this.prisma.roomMember.findMany({
      where: { userId },
      include: { room: { include: roomWithLastMessageInclude } },
      orderBy: { room: { lastMessageAt: 'desc' } },
    });

    const directRoomIds = memberships
      .filter((membership) => membership.room.type === RoomType.DIRECT)
      .map((membership) => membership.roomId);

    const peerRows =
      directRoomIds.length > 0
        ? await this.prisma.roomMember.findMany({
            where: { roomId: { in: directRoomIds }, userId: { not: userId } },
            select: { roomId: true, user: { select: userPreviewSelect } },
          })
        : [];
    const peers = new Map(peerRows.map((row) => [row.roomId, toUserPreview(row.user)]));

    const unreadCounts = await Promise.all(
      memberships.map((membership) =>
        this.unreadCount(membership.roomId, userId, membership.lastReadMessageId),
      ),
    );

    return memberships.map((membership, index) =>
      toRoomSummary(
        membership.room,
        membership,
        unreadCounts[index] ?? 0,
        peers.get(membership.roomId) ?? null,
      ),
    );
  }

  async listPublic(userId: string, query: ListPublicRoomsDto): Promise<Page<PublicRoomSummary>> {
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const rows = await this.prisma.room.findMany({
      where: {
        type: RoomType.PUBLIC,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
      include: roomWithLastMessageInclude,
    });

    const page = toPage(rows, limit);
    const roomIds = page.items.map((room) => room.id);
    const memberships =
      roomIds.length > 0
        ? await this.prisma.roomMember.findMany({
            where: { userId, roomId: { in: roomIds } },
            select: { roomId: true },
          })
        : [];
    const memberRooms = new Set(memberships.map((membership) => membership.roomId));

    return {
      items: page.items.map((room) => toPublicRoomSummary(room, memberRooms.has(room.id))),
      nextCursor: page.nextCursor,
    };
  }

  async getRoom(roomId: string, userId: string): Promise<RoomDetail> {
    const membership = await this.membership.assertMember(roomId, userId);
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: roomDetailInclude,
    });
    if (!room) {
      throw new AppError(ErrorCodes.ROOM_NOT_FOUND, 'Room not found', 404);
    }

    const peer = room.type === RoomType.DIRECT ? await this.findPeer(roomId, userId) : null;
    return toRoomDetail(room, membership, peer);
  }

  async join(roomId: string, userId: string): Promise<RoomDetail> {
    await this.membership.joinPublic(roomId, userId);
    return this.getRoom(roomId, userId);
  }

  private async getSummary(roomId: string, userId: string): Promise<RoomSummary> {
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: { room: { include: roomWithLastMessageInclude } },
    });
    if (!membership) {
      throw new AppError(ErrorCodes.ROOM_NOT_FOUND, 'Room not found', 404);
    }

    const unreadCount = await this.unreadCount(roomId, userId, membership.lastReadMessageId);
    const peer =
      membership.room.type === RoomType.DIRECT ? await this.findPeer(roomId, userId) : null;

    return toRoomSummary(membership.room, membership, unreadCount, peer);
  }

  private async findPeer(roomId: string, userId: string): Promise<UserPreview | null> {
    const row = await this.prisma.roomMember.findFirst({
      where: { roomId, userId: { not: userId } },
      select: { user: { select: userPreviewSelect } },
    });
    return row ? toUserPreview(row.user) : null;
  }

  /**
   * Counts unread messages (capped at 100) from the member's read pointer.
   * No per-message counters: one pointer per member keeps writes cheap.
   */
  private async unreadCount(
    roomId: string,
    userId: string,
    lastReadMessageId: string | null,
  ): Promise<number> {
    const rows = await this.prisma.message.findMany({
      where: {
        roomId,
        deletedAt: null,
        senderId: { not: userId },
        ...(lastReadMessageId ? { id: { gt: lastReadMessageId } } : {}),
      },
      select: { id: true },
      take: 100,
    });
    return rows.length;
  }
}
