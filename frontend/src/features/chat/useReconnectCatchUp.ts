import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RoomSummary } from '@/lib/api/types';
import { queryKeys } from '@/lib/query/keys';
import { applyMessageToRooms, mergeNewMessages, type MessagesData } from '@/lib/query/messages';
import { useConnectionStore } from '@/stores/connection';
import { fetchMessagesAfter } from './api';

/**
 * After a reconnect (or when re-entering a cached room), fetch messages newer
 * than the newest id in the cache. The socket adapter cannot replay missed
 * events, so this REST catch-up is the source of truth.
 */
export function useReconnectCatchUp(roomId: string, newestMessageId: string | null) {
  const queryClient = useQueryClient();
  const epoch = useConnectionStore((state) => state.epoch);
  const newestRef = useRef<string | null>(newestMessageId);
  const inFlight = useRef(false);

  useEffect(() => {
    newestRef.current = newestMessageId;
  }, [newestMessageId]);

  useEffect(() => {
    const after = newestRef.current;
    if (!after || inFlight.current) return;

    let cancelled = false;
    inFlight.current = true;

    fetchMessagesAfter(roomId, after)
      .then((missed) => {
        if (cancelled || missed.length === 0) return;

        queryClient.setQueryData<MessagesData>(queryKeys.messages(roomId), (data) =>
          mergeNewMessages(data, missed),
        );

        const latest = missed[missed.length - 1];
        if (latest) {
          queryClient.setQueryData<RoomSummary[]>(queryKeys.rooms, (rooms) =>
            applyMessageToRooms(rooms, latest, false),
          );
        }
      })
      .catch(() => {
        // Still offline. The next connect event retries.
      })
      .finally(() => {
        inFlight.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [roomId, epoch, queryClient]);

  // Refresh mutable room facts (mute state, member count) after reconnects.
  useEffect(() => {
    if (epoch === 0) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId) });
  }, [epoch, roomId, queryClient]);
}
