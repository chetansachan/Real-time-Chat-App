export type RoomType = 'PUBLIC' | 'PRIVATE' | 'DIRECT';
export type MemberRole = 'OWNER' | 'MEMBER';
export type MessageType = 'TEXT' | 'IMAGE' | 'SYSTEM';

export interface UserPreview {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export interface PublicUser extends UserPreview {
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  expiresIn: number;
}

export interface MessageDto {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  type: MessageType;
  clientMessageId: string;
  createdAt: string;
  deletedAt: string | null;
  sender: UserPreview;
}

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

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'ROOM_NOT_FOUND'
  | 'MESSAGE_NOT_FOUND'
  | 'NOT_A_MEMBER'
  | 'MUTED'
  | 'BANNED'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export type Ack<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string } };
