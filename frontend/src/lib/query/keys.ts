export const queryKeys = {
  me: ['users', 'me'] as const,
  rooms: ['rooms', 'mine'] as const,
  publicRooms: (search: string) => ['rooms', 'public', search] as const,
  room: (roomId: string) => ['rooms', 'detail', roomId] as const,
  members: (roomId: string) => ['rooms', 'members', roomId] as const,
  messages: (roomId: string) => ['messages', roomId] as const,
  userSearch: (search: string) => ['users', 'search', search] as const,
};
