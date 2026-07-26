import type { Ack, MessageDto, UserPreview } from '@/lib/api/types';

export type PresenceStatus = 'online' | 'offline';

export interface PresenceEntry {
  userId: string;
  status: PresenceStatus;
  lastSeenAt: string | null;
}

export interface TypingUpdate {
  roomId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface ReadReceipt {
  roomId: string;
  userId: string;
  lastReadMessageId: string;
}

export type MemberRemovedReason = 'kicked' | 'banned';

export interface MemberRemoved {
  roomId: string;
  userId: string;
  reason: MemberRemovedReason;
}

export interface MemberMuted {
  roomId: string;
  userId: string;
  mutedUntil: string | null;
}

export interface SendMessagePayload {
  roomId: string;
  content: string;
  clientMessageId: string;
}

export interface ClientToServerEvents {
  'message:send': (payload: SendMessagePayload, ack: (response: Ack<MessageDto>) => void) => void;
  'typing:start': (payload: { roomId: string }, ack: (response: Ack<TypingUpdate>) => void) => void;
  'typing:stop': (payload: { roomId: string }, ack: (response: Ack<TypingUpdate>) => void) => void;
  'read:mark': (payload: { roomId: string; messageId: string }, ack: (response: Ack<ReadReceipt>) => void) => void;
}

export interface ServerToClientEvents {
  'message:new': (message: MessageDto) => void;
  'message:deleted': (payload: { roomId: string; messageId: string }) => void;
  'message:read': (receipt: ReadReceipt) => void;
  'room:member-joined': (payload: { roomId: string; userId: string }) => void;
  'room:member-left': (payload: { roomId: string; userId: string }) => void;
  'room:member-removed': (payload: MemberRemoved) => void;
  'room:member-muted': (payload: MemberMuted) => void;
  'typing:update': (payload: TypingUpdate) => void;
  'presence:snapshot': (snapshot: { users: PresenceEntry[] }) => void;
  'presence:update': (update: PresenceEntry) => void;
  'auth:expired': () => void;
}

/** Re-exported for convenience where only previews are needed. */
export type Peer = UserPreview;
