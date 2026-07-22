import type { MemberRole, RoomType } from '@prisma/client';
import type { MessageDto } from '../messages/message.types';
import type { UserPreview } from '../users/user.mapper';

export interface RoomSummary {
  id: string;
  type: RoomType;
  name: string | null;
  ownerId: string | null;
  lastMessageAt: string;
  createdAt: string;
  unreadCount: number;
  memberCount: number;
  lastReadMessageId: string | null;
  role: MemberRole;
  peer: UserPreview | null;
  lastMessage: MessageDto | null;
}

export interface PublicRoomSummary {
  id: string;
  type: RoomType;
  name: string | null;
  lastMessageAt: string;
  createdAt: string;
  memberCount: number;
  isMember: boolean;
  lastMessage: MessageDto | null;
}

export interface RoomMemberDto {
  userId: string;
  role: MemberRole;
  joinedAt: string;
  mutedUntil: string | null;
  user: UserPreview;
}

export interface RoomDetail {
  id: string;
  type: RoomType;
  name: string | null;
  ownerId: string | null;
  lastMessageAt: string;
  createdAt: string;
  memberCount: number;
  role: MemberRole;
  mutedUntil: string | null;
  lastReadMessageId: string | null;
  peer: UserPreview | null;
  members: RoomMemberDto[];
}
