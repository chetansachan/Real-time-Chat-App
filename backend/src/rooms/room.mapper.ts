import type { MemberRole, Prisma, RoomMember } from '@prisma/client';
import { messageWithSenderInclude, toMessageDto } from '../messages/message.mapper';
import { toUserPreview, userPreviewSelect, type UserPreviewRow } from '../users/user.mapper';
import type { PublicRoomSummary, RoomDetail, RoomMemberDto, RoomSummary } from './rooms.types';
import type { UserPreview } from '../users/user.mapper';

export const roomWithLastMessageInclude = {
  messages: {
    where: { deletedAt: null },
    orderBy: { id: 'desc' },
    take: 1,
    include: messageWithSenderInclude,
  },
  _count: { select: { members: true } },
} satisfies Prisma.RoomInclude;

export const roomDetailInclude = {
  members: {
    include: { user: { select: userPreviewSelect } },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  },
  _count: { select: { members: true } },
} satisfies Prisma.RoomInclude;

export type RoomWithLastMessage = Prisma.RoomGetPayload<{
  include: typeof roomWithLastMessageInclude;
}>;

export type RoomWithDetail = Prisma.RoomGetPayload<{ include: typeof roomDetailInclude }>;

type MembershipPointer = Pick<RoomMember, 'role' | 'lastReadMessageId'>;
type MembershipDetail = Pick<RoomMember, 'role' | 'lastReadMessageId' | 'mutedUntil'>;

export function toRoomSummary(
  room: RoomWithLastMessage,
  membership: MembershipPointer,
  unreadCount: number,
  peer: UserPreview | null,
): RoomSummary {
  const last = room.messages[0];
  return {
    id: room.id,
    type: room.type,
    name: room.name,
    ownerId: room.ownerId,
    lastMessageAt: room.lastMessageAt.toISOString(),
    createdAt: room.createdAt.toISOString(),
    unreadCount,
    memberCount: room._count.members,
    lastReadMessageId: membership.lastReadMessageId,
    role: membership.role,
    peer,
    lastMessage: last ? toMessageDto(last) : null,
  };
}

export function toPublicRoomSummary(
  room: RoomWithLastMessage,
  isMember: boolean,
): PublicRoomSummary {
  const last = room.messages[0];
  return {
    id: room.id,
    type: room.type,
    name: room.name,
    lastMessageAt: room.lastMessageAt.toISOString(),
    createdAt: room.createdAt.toISOString(),
    memberCount: room._count.members,
    isMember,
    lastMessage: last ? toMessageDto(last) : null,
  };
}

export function toRoomMemberDto(member: {
  userId: string;
  role: MemberRole;
  joinedAt: Date;
  mutedUntil: Date | null;
  user: UserPreviewRow;
}): RoomMemberDto {
  return {
    userId: member.userId,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
    mutedUntil: member.mutedUntil ? member.mutedUntil.toISOString() : null,
    user: toUserPreview(member.user),
  };
}

export function toRoomDetail(
  room: RoomWithDetail,
  membership: MembershipDetail,
  peer: UserPreview | null,
): RoomDetail {
  return {
    id: room.id,
    type: room.type,
    name: room.name,
    ownerId: room.ownerId,
    lastMessageAt: room.lastMessageAt.toISOString(),
    createdAt: room.createdAt.toISOString(),
    memberCount: room._count.members,
    role: membership.role,
    mutedUntil: membership.mutedUntil ? membership.mutedUntil.toISOString() : null,
    lastReadMessageId: membership.lastReadMessageId,
    peer,
    members: room.members.map(toRoomMemberDto),
  };
}
