import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RoomSummary } from '@/lib/api/types';
import { queryKeys } from '@/lib/query/keys';
import { markRoomRead as markRoomReadCache } from '@/lib/query/messages';
import { markRoomRead as markRoomReadRequest } from '@/features/rooms/api';

/** Advances the read pointer at most once per distinct message id. */
export function useMarkRead(roomId: string) {
  const queryClient = useQueryClient();
  const lastSentRef = useRef<string | null>(null);

  return useCallback(
    (messageId: string | null | undefined) => {
      if (!messageId) return;
      if (lastSentRef.current && messageId <= lastSentRef.current) return;
      lastSentRef.current = messageId;

      queryClient.setQueryData<RoomSummary[]>(queryKeys.rooms, (rooms) =>
        markRoomReadCache(rooms, roomId, messageId),
      );

      void markRoomReadRequest(roomId, messageId).catch(() => {
        // Non-critical: allow a later attempt to move the pointer.
        if (lastSentRef.current === messageId) lastSentRef.current = null;
      });
    },
    [queryClient, roomId],
  );
}
