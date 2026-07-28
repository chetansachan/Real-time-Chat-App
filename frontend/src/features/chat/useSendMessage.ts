import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/client';
import type { MessageDto, RoomSummary } from '@/lib/api/types';
import { queryKeys } from '@/lib/query/keys';
import { applyMessageToRooms, upsertMessage, type MessagesData } from '@/lib/query/messages';
import { socket } from '@/lib/socket/socket';
import { useAuthStore } from '@/stores/auth';
import { usePendingStore, type PendingMessage } from '@/stores/pending';
import { sendMessageRest } from './api';

const SEND_TIMEOUT_MS = 5000;

/**
 * Optimistic send pipeline. Pending messages live in a Zustand store keyed by
 * clientMessageId; the ack, the broadcast, or a REST response reconciles them.
 */
export function useSendMessage(roomId: string) {
  const queryClient = useQueryClient();
  const addPending = usePendingStore((state) => state.add);
  const failPending = usePendingStore((state) => state.fail);
  const removePending = usePendingStore((state) => state.remove);
  const markPendingSending = usePendingStore((state) => state.markSending);

  const finalize = useCallback(
    (clientMessageId: string, message: MessageDto) => {
      queryClient.setQueryData<MessagesData>(queryKeys.messages(roomId), (data) =>
        upsertMessage(data, message),
      );
      queryClient.setQueryData<RoomSummary[]>(queryKeys.rooms, (rooms) =>
        applyMessageToRooms(rooms, message, false),
      );
      removePending(roomId, clientMessageId);
    },
    [queryClient, removePending, roomId],
  );

  const dispatch = useCallback(
    (clientMessageId: string, content: string) => {
      const fail = (message: string) => failPending(roomId, clientMessageId, message);

      if (socket.connected) {
        socket.timeout(SEND_TIMEOUT_MS).emit(
          'message:send',
          { roomId, content, clientMessageId },
          (timeoutError, ack) => {
            if (timeoutError) {
              fail('Timed out. Tap to retry.');
              return;
            }
            if (!ack) {
              fail('No response from the server. Tap to retry.');
              return;
            }
            if (ack.ok) {
              finalize(clientMessageId, ack.data);
            } else {
              fail(ack.error.message);
            }
          },
        );
        return;
      }

      // Offline: the REST route persists and broadcasts, and returns the message.
      void sendMessageRest(roomId, content, clientMessageId)
        .then((message) => finalize(clientMessageId, message))
        .catch((error: unknown) => {
          fail(error instanceof ApiError ? error.message : 'Message failed to send.');
        });
    },
    [failPending, finalize, roomId],
  );

  const send = useCallback(
    (content: string): boolean => {
      const user = useAuthStore.getState().user;
      const trimmed = content.trim();
      if (!user || trimmed.length === 0) return false;

      const clientMessageId = crypto.randomUUID();
      addPending({
        clientMessageId,
        roomId,
        content: trimmed,
        createdAt: new Date().toISOString(),
        status: 'sending',
      });
      dispatch(clientMessageId, trimmed);
      return true;
    },
    [addPending, dispatch, roomId],
  );

  const retry = useCallback(
    (message: PendingMessage) => {
      markPendingSending(roomId, message.clientMessageId);
      dispatch(message.clientMessageId, message.content);
    },
    [dispatch, markPendingSending, roomId],
  );

  return { send, retry };
}
