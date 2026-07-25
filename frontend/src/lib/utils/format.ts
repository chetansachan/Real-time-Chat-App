import type { MessageDto, RoomDetail, RoomSummary } from '@/lib/api/types';

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});

const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });

const longDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

export function isSameDay(a: Date | string, b: Date | string): boolean {
  const first = typeof a === 'string' ? new Date(a) : a;
  const second = typeof b === 'string' ? new Date(b) : b;
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

export function formatTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return timeFormatter.format(date);
}

export function formatDayLabel(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const now = new Date();
  if (isSameDay(date, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';
  if (date.getFullYear() === now.getFullYear()) return shortDateFormatter.format(date);
  return `${shortDateFormatter.format(date)}, ${date.getFullYear()}`;
}

/** Compact timestamp for the room list. */
export function formatRoomTimestamp(value: string): string {
  const date = new Date(value);
  const now = new Date();
  if (isSameDay(date, now)) return timeFormatter.format(date);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays < 7) return weekdayFormatter.format(date);
  return shortDateFormatter.format(date);
}

export function formatFullDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return longDateFormatter.format(date);
}

export function messagePreview(message: MessageDto | null): string {
  if (!message) return 'No messages yet';
  if (message.deletedAt) return 'Message deleted';
  return message.content;
}

export function roomDisplayName(room: Pick<RoomSummary | RoomDetail, 'type' | 'name' | 'peer'>): string {
  if (room.type === 'DIRECT') return room.peer?.username ?? 'Direct message';
  return room.name?.trim() || 'Untitled room';
}

export function roomAudience(room: Pick<RoomSummary | RoomDetail, 'type' | 'memberCount'>): string {
  if (room.type === 'DIRECT') return 'Direct message';
  return `${room.memberCount} ${room.memberCount === 1 ? 'member' : 'members'}`;
}

export function truncate(value: string, max = 80): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
