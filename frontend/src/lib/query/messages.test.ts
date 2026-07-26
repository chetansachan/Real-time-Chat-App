import { describe, expect, it } from 'vitest';
import type { MessageDto, RoomSummary } from '@/lib/api/types';
import {
  applyDeletedMessageToRooms,
  applyMessageToRooms,
  markRoomRead,
  mergeNewMessages,
  removeMessage,
  upsertMessage,
  type MessagesData,
} from './messages';

function message(id: string, overrides: Partial<MessageDto> = {}): MessageDto {
  return {
    id,
    roomId: 'room-1',
    senderId: 'user-1',
    content: `message ${id}`,
    type: 'TEXT',
    clientMessageId: `client-${id}`,
    createdAt: new Date(2026, 0, 1).toISOString(),
    deletedAt: null,
    sender: { id: 'user-1', username: 'alice', avatarUrl: null },
    ...overrides,
  };
}

function data(items: MessageDto[]): MessagesData {
  return { pages: [{ items, nextCursor: null }], pageParams: [null] };
}

function room(overrides: Partial<RoomSummary> = {}): RoomSummary {
  return {
    id: 'room-1',
    type: 'PUBLIC',
    name: 'general',
    ownerId: 'user-1',
    lastMessageAt: '2026-01-01T10:00:00.000Z',
    createdAt: '2026-01-01T09:00:00.000Z',
    unreadCount: 0,
    memberCount: 2,
    lastReadMessageId: null,
    role: 'MEMBER',
    peer: null,
    lastMessage: null,
    ...overrides,
  };
}

describe('upsertMessage', () => {
  it('prepends a new message to the newest page', () => {
    const existing = message('018f-a', { createdAt: '2026-01-01T10:00:00.000Z' });
    const incoming = message('018f-b', {
      createdAt: '2026-01-01T10:01:00.000Z',
      content: 'hello',
    });

    const result = upsertMessage(data([existing]), incoming);

    expect(result?.pages[0]?.items.map((item) => item.id)).toEqual(['018f-b', '018f-a']);
  });

  it('replaces an optimistic row by clientMessageId', () => {
    const optimistic = message('018f-temp', {
      content: 'hi',
      clientMessageId: 'client-shared',
      createdAt: '2026-01-01T10:00:00.000Z',
    });
    const confirmed = message('018f-real', {
      content: 'hi',
      clientMessageId: 'client-shared',
      createdAt: '2026-01-01T10:00:01.000Z',
    });

    const result = upsertMessage(data([optimistic]), confirmed);

    expect(result?.pages[0]?.items).toHaveLength(1);
    expect(result?.pages[0]?.items[0]?.id).toBe('018f-real');
  });

  it('does not duplicate the same id', () => {
    const existing = message('018f-a');
    const updated = { ...existing, content: 'edited' };

    const result = upsertMessage(data([existing]), updated);

    expect(result?.pages[0]?.items).toHaveLength(1);
    expect(result?.pages[0]?.items[0]?.content).toBe('edited');
  });

  it('returns the input when there is no cache', () => {
    expect(upsertMessage(undefined, message('018f-a'))).toBeUndefined();
  });
});

describe('mergeNewMessages', () => {
  it('prepends missed messages newest-first and skips duplicates', () => {
    const existing = message('018f-c');
    const missedOld = message('018f-d');
    const missedNew = message('018f-e');

    const result = mergeNewMessages(data([existing]), [missedOld, missedNew, existing]);

    expect(result?.pages[0]?.items.map((item) => item.id)).toEqual([
      '018f-e',
      '018f-d',
      '018f-c',
    ]);
  });

  it('deduplicates by sender and clientMessageId', () => {
    const existing = message('018f-c', { clientMessageId: 'client-shared' });
    const duplicate = message('018f-z', { clientMessageId: 'client-shared' });
    const cache = data([existing]);

    const result = mergeNewMessages(cache, [duplicate]);

    expect(result).toBe(cache);
    expect(result?.pages[0]?.items).toHaveLength(1);
  });
});

describe('removeMessage', () => {
  it('removes a message from a page', () => {
    const result = removeMessage(data([message('018f-a'), message('018f-b')]), '018f-a');

    expect(result?.pages[0]?.items.map((item) => item.id)).toEqual(['018f-b']);
  });
});

describe('room cache helpers', () => {
  it('bumps a room to the top and increments unread', () => {
    const older = room({ id: 'room-1', lastMessageAt: '2026-01-01T10:00:00.000Z' });
    const newer = room({ id: 'room-2', lastMessageAt: '2026-01-01T11:00:00.000Z' });
    const incoming = message('018f-new', {
      roomId: 'room-1',
      createdAt: '2026-01-01T12:00:00.000Z',
      senderId: 'user-2',
    });

    const result = applyMessageToRooms([older, newer], incoming, true);

    expect(result?.map((item) => item.id)).toEqual(['room-1', 'room-2']);
    expect(result?.[0]?.unreadCount).toBe(1);
    expect(result?.[0]?.lastMessage?.id).toBe('018f-new');
  });

  it('does not increment unread for an active room', () => {
    const incoming = message('018f-new', { createdAt: '2026-01-01T12:00:00.000Z' });
    const result = applyMessageToRooms([room()], incoming, false);

    expect(result?.[0]?.unreadCount).toBe(0);
  });

  it('marks the last message as deleted in the preview', () => {
    const last = message('018f-a');
    const result = applyDeletedMessageToRooms(
      [room({ lastMessage: last })],
      'room-1',
      '018f-a',
    );

    expect(result?.[0]?.lastMessage?.deletedAt).not.toBeNull();
  });

  it('clears unread when the read pointer advances', () => {
    const result = markRoomRead([room({ unreadCount: 4 })], 'room-1', '018f-a');

    expect(result?.[0]?.unreadCount).toBe(0);
    expect(result?.[0]?.lastReadMessageId).toBe('018f-a');
  });
});
