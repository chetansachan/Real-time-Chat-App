import { useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { listMessages } from './api';

export function useRoomMessages(roomId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.messages(roomId),
    queryFn: ({ pageParam, signal }) => listMessages(roomId, pageParam, 30, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Live updates and reconnect catch-up keep the cache fresh; refetching every
    // loaded page on focus would multiply requests for long histories.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    enabled: Boolean(roomId),
  });
}
