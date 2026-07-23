import type { Server, Socket } from 'socket.io';
import type { Ack } from '../common/types/ack';
import type { SocketUser } from '../common/types/auth-user';
import type { SendMessageDto } from '../messages/dto/send-message.dto';
import type { MessageDto } from '../messages/message.types';
import type { ReadReceiptDto } from './dto/read-receipt.dto';
import type { TypingDto } from './dto/typing.dto';

/**
 * Socket event catalogue. Keep this in sync with the README; socket payloads are
 * not covered by Swagger.
 */

export type PresenceStatus = 'online' | 'offline';

export interface PresenceEntry {
  userId: string;
  status: PresenceStatus;
  lastSeenAt: string | null;
}

export interface PresenceSnapshot {
  users: PresenceEntry[];
}

export type PresenceUpdate = PresenceEntry;

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

export interface ClientToServerEvents {
  'message:send': (payload: SendMessageDto, ack: (response: Ack<MessageDto>) => void) => void;
  'typing:start': (payload: TypingDto, ack: (response: Ack<TypingUpdate>) => void) => void;
  'typing:stop': (payload: TypingDto, ack: (response: Ack<TypingUpdate>) => void) => void;
  'read:mark': (payload: ReadReceiptDto, ack: (response: Ack<ReadReceipt>) => void) => void;
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
  'presence:snapshot': (snapshot: PresenceSnapshot) => void;
  'presence:update': (update: PresenceUpdate) => void;
  'auth:expired': () => void;
}

export interface SocketData {
  user: SocketUser;
}

export type ChatServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export type ChatSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export const roomChannel = (roomId: string): string => `room:${roomId}`;
export const userChannel = (userId: string): string => `user:${userId}`;
