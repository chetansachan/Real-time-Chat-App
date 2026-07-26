import type { InfiniteData } from '@tanstack/react-query';
import type { MessageDto, RoomSummary } from '@/lib/api/types';

export interface MessagesPage {
  items: MessageDto[];
  nextCursor: string | null;
}

export type MessagesData = InfiniteData<MessagesPage, string | null>;

export function isSameMessage(a: MessageDto, b: MessageDto): boolean {
  return a.id === b.id || (a.senderId === b.senderId && a.clientMessageId === b.clientMessageId);
}

/**
 * Insert or replace a live/acked message. New messages go to the front of the
 * newest page because pages are stored newest-first.
 */
export function upsertMessage(
  data: MessagesData | undefined,
  message: MessageDto,
): MessagesData | undefined {
  if (!data || data.pages.length === 0) return data;

  let found = false;
  let changed = false;
  const pages = data.pages.map((page) => {
    let pageChanged = false;
    const items = page.items.map((existing) => {
      if (!isSameMessage(existing, message)) return existing;
      found = true;
      if (
        existing.id === message.id &&
        existing.content === message.content &&
        existing.deletedAt === message.deletedAt
      ) {
        return existing;
      }
      pageChanged = true;
      return message;
    });
    if (!pageChanged) return page;
    changed = true;
    return { ...page, items };
  });

  if (found) {
    return changed ? { ...data, pages } : data;
  }

  const newest = pages[0];
  if (!newest) return data;
  return {
    ...data,
    pages: [{ ...newest, items: [message, ...newest.items] }, ...pages.slice(1)],
  };
}

/**
 * Merge a batch of messages that are newer than everything in the cache
 * (reconnect catch-up). `incoming` may be in ascending order; duplicates are
 * discarded by id and by clientMessageId.
 */
export function mergeNewMessages(
  data: MessagesData | undefined,
  incoming: MessageDto[],
): MessagesData | undefined {
  if (!data || data.pages.length === 0 || incoming.length === 0) return data;

  const known = new Set<string>();
  const knownClientIds = new Set<string>();
  for (const page of data.pages) {
    for (const message of page.items) {
      known.add(message.id);
      knownClientIds.add(`${message.senderId}:${message.clientMessageId}`);
    }
  }

  const fresh: MessageDto[] = [];
  for (const message of incoming) {
    if (known.has(message.id) || knownClientIds.has(`${message.senderId}:${message.clientMessageId}`)) {
      continue;
    }
    known.add(message.id);
    knownClientIds.add(`${message.senderId}:${message.clientMessageId}`);
    fresh.push(message);
  }
  if (fresh.length === 0) return data;

  fresh.sort((a, b) => a.id.localeCompare(b.id));
  const newest = data.pages[0];
  if (!newest) return data;

  return {
    ...data,
    pages: [
      { ...newest, items: [...fresh.slice().reverse(), ...newest.items] },
      ...data.pages.slice(1),
    ],
  };
}

export function removeMessage(
  data: MessagesData | undefined,
  messageId: string,
): MessagesData | undefined {
  if (!data) return data;
  let changed = false;
  const pages = data.pages.map((page) => {
    const items = page.items.filter((message) => message.id !== messageId);
    if (items.length === page.items.length) return page;
    changed = true;
    return { ...page, items };
  });
  return changed ? { ...data, pages } : data;
}

const byNewest = (a: RoomSummary, b: RoomSummary): number =>
  b.lastMessageAt.localeCompare(a.lastMessageAt);

export function applyMessageToRooms(
  rooms: RoomSummary[] | undefined,
  message: MessageDto,
  incrementUnread: boolean,
): RoomSummary[] | undefined {
  if (!rooms) return rooms;
  const next = rooms.map((room) =>
    room.id === message.roomId
      ? {
          ...room,
          lastMessage: message,
          lastMessageAt: message.createdAt,
          unreadCount: incrementUnread ? room.unreadCount + 1 : room.unreadCount,
        }
      : room,
  );
  return next.sort(byNewest);
}

export function applyDeletedMessageToRooms(
  rooms: RoomSummary[] | undefined,
  roomId: string,
  messageId: string,
): RoomSummary[] | undefined {
  if (!rooms) return rooms;
  return rooms.map((room) => {
    if (room.id !== roomId || room.lastMessage?.id !== messageId) return room;
    return {
      ...room,
      lastMessage: { ...room.lastMessage, content: '', deletedAt: new Date().toISOString() },
    };
  });
}

export function markRoomRead(
  rooms: RoomSummary[] | undefined,
  roomId: string,
  lastReadMessageId: string | null,
): RoomSummary[] | undefined {
  if (!rooms) return rooms;
  return rooms.map((room) =>
    room.id === roomId ? { ...room, unreadCount: 0, lastReadMessageId } : room,
  );
}

export function removeRoomFromList(
  rooms: RoomSummary[] | undefined,
  roomId: string,
): RoomSummary[] | undefined {
  return rooms?.filter((room) => room.id !== roomId);
}
