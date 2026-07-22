import { Injectable } from '@nestjs/common';
import { MemberRole, Prisma, RoomType } from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/types/error-codes';
import { PrismaService } from '../database/prisma.service';
import { RealtimeService } from '../chat/realtime.service';
import { toRoomMemberDto } from './room.mapper';
import { RoomPolicyService } from './room-policy.service';
import type { RoomMemberDto } from './rooms.types';
import { userPreviewSelect } from '../users/user.mapper';

export type MembershipWithRoom = Prisma.RoomMemberGetPayload<{ include: { room: true } }>;

@Injectable()
export class MembershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: RoomPolicyService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Resolves membership and the room in one query. Private and direct rooms
   * report "not found" to non-members so their existence does not leak.
   */
  async assertMember(roomId: string, userId: string): Promise<MembershipWithRoom> {
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: { room: true },
    });
    if (membership) {
      return membership;
    }

    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { type: true },
    });
    if (!room || room.type !== RoomType.PUBLIC) {
      throw new AppError(ErrorCodes.ROOM_NOT_FOUND, 'Room not found', 404);
    }
    throw new AppError(ErrorCodes.NOT_A_MEMBER, 'You are not a member of this room', 403);
  }

  async assertOwner(roomId: string, userId: string): Promise<MembershipWithRoom> {
    const membership = await this.assertMember(roomId, userId);
    if (membership.role !== MemberRole.OWNER) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Only the room owner can do this', 403);
    }
    return membership;
  }

  async listRoomIdsForUser(userId: string, limit: number): Promise<string[]> {
    const rows = await this.prisma.roomMember.findMany({
      where: { userId },
      select: { roomId: true },
      orderBy: { joinedAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => row.roomId);
  }

  /** Distinct users sharing at least one room with `userId`, for presence snapshots. */
  async listPeerIdsForUser(userId: string, limit: number): Promise<string[]> {
    const memberships = await this.prisma.roomMember.findMany({
      where: { userId },
      select: { roomId: true },
    });
    if (memberships.length === 0) {
      return [];
    }

    const rows = await this.prisma.roomMember.findMany({
      where: {
        roomId: { in: memberships.map((membership) => membership.roomId) },
        userId: { not: userId },
      },
      select: { userId: true },
      distinct: ['userId'],
      take: limit,
    });
    return rows.map((row) => row.userId);
  }

  async joinPublic(roomId: string, userId: string): Promise<void> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { type: true },
    });
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      select: { userId: true },
    });
    const banned = membership ? false : await this.isBanned(roomId, userId);

    if (!room || !this.policy.canJoinRoom(room.type, membership !== null, banned)) {
      if (banned) {
        throw new AppError(ErrorCodes.BANNED, 'You are banned from this room', 403);
      }
      throw new AppError(ErrorCodes.ROOM_NOT_FOUND, 'Room not found', 404);
    }

    if (membership) {
      return;
    }

    await this.prisma.roomMember.create({ data: { roomId, userId } });
    this.realtime.joinRoomForUser(userId, roomId);
    this.realtime.emitToRoom(roomId, 'room:member-joined', { roomId, userId });
  }

  async addMembers(roomId: string, actorId: string, userIds: string[]): Promise<RoomMemberDto[]> {
    const membership = await this.assertOwner(roomId, actorId);
    if (membership.room.type === RoomType.DIRECT) {
      throw new AppError(ErrorCodes.VALIDATION, 'Cannot add members to a direct room', 400);
    }
    if (!this.policy.canInvite(membership.role)) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Only the room owner can invite members', 403);
    }

    const uniqueIds = [...new Set(userIds)].filter((userId) => userId !== actorId);
    if (uniqueIds.length === 0) {
      return this.listMembers(roomId, actorId);
    }

    await this.ensureUsersExist(uniqueIds);
    const existing = await this.prisma.roomMember.findMany({
      where: { roomId, userId: { in: uniqueIds } },
      select: { userId: true },
    });
    const existingIds = new Set(existing.map((row) => row.userId));
    const newIds = uniqueIds.filter((userId) => !existingIds.has(userId));

    if (newIds.length > 0) {
      await this.prisma.roomMember.createMany({
        data: newIds.map((userId) => ({ roomId, userId })),
        skipDuplicates: true,
      });
      for (const userId of newIds) {
        this.realtime.joinRoomForUser(userId, roomId);
        this.realtime.emitToRoom(roomId, 'room:member-joined', { roomId, userId });
      }
    }

    return this.listMembers(roomId, actorId);
  }

  async leave(roomId: string, userId: string): Promise<void> {
    const membership = await this.assertMember(roomId, userId);
    if (!this.policy.canLeave(membership.role)) {
      throw new AppError(
        ErrorCodes.CONFLICT,
        'Owners cannot leave; transfer ownership or delete the room first',
        409,
      );
    }

    await this.prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId } },
    });
    this.realtime.leaveRoomForUser(userId, roomId);
    this.realtime.emitToRoom(roomId, 'room:member-left', { roomId, userId });
  }

  async kick(roomId: string, actorId: string, targetId: string): Promise<void> {
    await this.assertModeratableTarget(roomId, actorId, targetId);
    await this.prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId: targetId } },
    });
    this.announceRemoval(roomId, targetId, 'kicked');
  }

  async ban(
    roomId: string,
    actorId: string,
    targetId: string,
    reason: string | undefined,
    durationSeconds: number | undefined,
  ): Promise<void> {
    await this.assertModeratableTarget(roomId, actorId, targetId);
    const expiresAt =
      durationSeconds === undefined ? null : new Date(Date.now() + durationSeconds * 1_000);
    const trimmedReason = reason?.trim() || null;

    await this.prisma.$transaction([
      this.prisma.roomBan.upsert({
        where: { roomId_userId: { roomId, userId: targetId } },
        update: { reason: trimmedReason, expiresAt },
        create: {
          roomId,
          userId: targetId,
          reason: trimmedReason,
          expiresAt,
        },
      }),
      this.prisma.roomMember.delete({
        where: { roomId_userId: { roomId, userId: targetId } },
      }),
    ]);

    this.announceRemoval(roomId, targetId, 'banned');
  }

  async unban(roomId: string, actorId: string, targetId: string): Promise<void> {
    await this.assertOwner(roomId, actorId);
    const result = await this.prisma.roomBan.deleteMany({
      where: { roomId, userId: targetId },
    });
    if (result.count === 0) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'No active ban for that user', 404);
    }
  }

  async mute(
    roomId: string,
    actorId: string,
    targetId: string,
    durationSeconds: number,
  ): Promise<string> {
    await this.assertModeratableTarget(roomId, actorId, targetId);
    const mutedUntil = new Date(Date.now() + durationSeconds * 1_000);
    await this.prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId: targetId } },
      data: { mutedUntil },
    });
    this.realtime.emitToRoom(roomId, 'room:member-muted', {
      roomId,
      userId: targetId,
      mutedUntil: mutedUntil.toISOString(),
    });
    return mutedUntil.toISOString();
  }

  async unmute(roomId: string, actorId: string, targetId: string): Promise<void> {
    await this.assertModeratableTarget(roomId, actorId, targetId);
    await this.prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId: targetId } },
      data: { mutedUntil: null },
    });
    this.realtime.emitToRoom(roomId, 'room:member-muted', {
      roomId,
      userId: targetId,
      mutedUntil: null,
    });
  }

  async listMembers(roomId: string, userId: string): Promise<RoomMemberDto[]> {
    await this.assertMember(roomId, userId);
    const rows = await this.prisma.roomMember.findMany({
      where: { roomId },
      include: { user: { select: userPreviewSelect } },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
    return rows.map(toRoomMemberDto);
  }

  async ensureUsersExist(userIds: string[]): Promise<void> {
    if (userIds.length === 0) {
      return;
    }
    const uniqueIds = [...new Set(userIds)];
    const count = await this.prisma.user.count({ where: { id: { in: uniqueIds } } });
    if (count !== uniqueIds.length) {
      throw new AppError(ErrorCodes.VALIDATION, 'One or more users do not exist', 400);
    }
  }

  /**
   * Common checks for kick/ban/mute: the actor must own a non-direct room and
   * the target must be a non-owner member.
   */
  private async assertModeratableTarget(
    roomId: string,
    actorId: string,
    targetId: string,
  ): Promise<void> {
    const actor = await this.assertOwner(roomId, actorId);
    if (actor.room.type === RoomType.DIRECT) {
      throw new AppError(ErrorCodes.VALIDATION, 'Direct rooms do not support moderation', 400);
    }
    if (actorId === targetId) {
      throw new AppError(ErrorCodes.VALIDATION, 'You cannot moderate yourself', 400);
    }

    const target = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: targetId } },
      select: { role: true },
    });
    if (!target) {
      throw new AppError(ErrorCodes.NOT_A_MEMBER, 'That user is not a member of this room', 404);
    }
    if (!this.policy.canRemoveMember(actor.role, target.role)) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'You cannot moderate that member', 403);
    }
  }

  private announceRemoval(roomId: string, userId: string, reason: 'kicked' | 'banned'): void {
    const payload = { roomId, userId, reason };
    this.realtime.emitToRoomExceptUser(roomId, userId, 'room:member-removed', payload);
    this.realtime.emitToUser(userId, 'room:member-removed', payload);
    this.realtime.leaveRoomForUser(userId, roomId);
  }

  private async isBanned(roomId: string, userId: string): Promise<boolean> {
    const ban = await this.prisma.roomBan.findFirst({
      where: {
        roomId,
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { userId: true },
    });
    return ban !== null;
  }
}
