import { request } from '@/lib/api/client';
import type { MessageDto, Page } from '@/lib/api/types';

const MAX_CATCH_UP_PAGES = 10;

export function listMessages(
  roomId: string,
  before: string | null,
  limit = 30,
  signal?: AbortSignal,
): Promise<Page<MessageDto>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set('before', before);
  return request<Page<MessageDto>>(`/rooms/${roomId}/messages?${params.toString()}`, { signal });
}

/**
 * Fetch everything after the newest known message, following pagination.
 * UUIDv7 ids are time-ordered, so the cursor can be a message id.
 */
export async function fetchMessagesAfter(roomId: string, after: string): Promise<MessageDto[]> {
  const collected: MessageDto[] = [];
  let cursor = after;

  for (let page = 0; page < MAX_CATCH_UP_PAGES; page += 1) {
    const params = new URLSearchParams({ after: cursor, limit: '100' });
    const result = await request<Page<MessageDto>>(`/rooms/${roomId}/messages?${params.toString()}`);
    collected.push(...result.items);
    if (!result.nextCursor || result.nextCursor === cursor) break;
    cursor = result.nextCursor;
  }

  return collected;
}

/** REST fallback used when the socket is not connected. */
export function sendMessageRest(
  roomId: string,
  content: string,
  clientMessageId: string,
): Promise<MessageDto> {
  return request<MessageDto>(`/rooms/${roomId}/messages`, {
    method: 'POST',
    body: { content, clientMessageId },
  });
}

export function deleteMessage(messageId: string): Promise<{ success: true }> {
  return request<{ success: true }>(`/messages/${messageId}`, { method: 'DELETE' });
}
