import { request } from '@/lib/api/client';
import type {
  Page,
  PublicRoomSummary,
  RoomDetail,
  RoomSummary,
  RoomType,
} from '@/lib/api/types';

export interface CreateRoomInput {
  type: Extract<RoomType, 'PUBLIC' | 'PRIVATE'>;
  name: string;
}

export function listRooms(): Promise<RoomSummary[]> {
  return request<RoomSummary[]>('/rooms');
}

export function getRoom(roomId: string): Promise<RoomDetail> {
  return request<RoomDetail>(`/rooms/${roomId}`);
}

export function createRoom(input: CreateRoomInput): Promise<RoomSummary> {
  return request<RoomSummary>('/rooms', { method: 'POST', body: input });
}

export function createDirectRoom(userId: string): Promise<RoomSummary> {
  return request<RoomSummary>('/rooms/direct', { method: 'POST', body: { userId } });
}

export function listPublicRooms(
  search: string,
  cursor: string | null,
): Promise<Page<PublicRoomSummary>> {
  const params = new URLSearchParams({ limit: '20' });
  if (search.trim()) params.set('search', search.trim());
  if (cursor) params.set('cursor', cursor);
  return request<Page<PublicRoomSummary>>(`/rooms/public?${params.toString()}`);
}

export function joinRoom(roomId: string): Promise<RoomDetail> {
  return request<RoomDetail>(`/rooms/${roomId}/join`, { method: 'POST' });
}

export function leaveRoom(roomId: string): Promise<{ success: true }> {
  return request<{ success: true }>(`/rooms/${roomId}/leave`, { method: 'POST' });
}

export function markRoomRead(roomId: string, messageId: string): Promise<{
  roomId: string;
  lastReadMessageId: string | null;
}> {
  return request(`/rooms/${roomId}/read`, { method: 'POST', body: { messageId } });
}
