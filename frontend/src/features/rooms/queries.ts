import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getRoom, listPublicRooms, listRooms } from './api';
import { queryKeys } from '@/lib/query/keys';
import { searchUsers } from '@/features/users/api';

export function useRooms() {
  return useQuery({
    queryKey: queryKeys.rooms,
    queryFn: listRooms,
    staleTime: 15_000,
  });
}

export function useRoom(roomId: string) {
  return useQuery({
    queryKey: queryKeys.room(roomId),
    queryFn: () => getRoom(roomId),
    staleTime: 30_000,
    enabled: Boolean(roomId),
  });
}

export function usePublicRooms(search: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.publicRooms(search),
    queryFn: ({ pageParam }) => listPublicRooms(search, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 15_000,
  });
}

export function useUserSearch(search: string) {
  return useQuery({
    queryKey: queryKeys.userSearch(search),
    queryFn: () => searchUsers(search),
    staleTime: 30_000,
  });
}
