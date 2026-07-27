import { NavLink } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui/Avatar';
import type { RoomSummary } from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';
import { formatRoomTimestamp, messagePreview, roomDisplayName } from '@/lib/utils/format';

interface RoomListItemProps {
  room: RoomSummary;
  currentUserId: string;
}

export function RoomListItem({ room, currentUserId }: RoomListItemProps) {
  const name = roomDisplayName(room);
  const preview = messagePreview(room.lastMessage);
  const last = room.lastMessage;
  const showSender =
    room.type !== 'DIRECT' && last !== null && last.senderId !== currentUserId && !last.deletedAt;
  const unread = room.unreadCount;

  return (
    <NavLink
      to={`/rooms/${room.id}`}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors duration-150',
          isActive ? 'bg-panel' : 'hover:bg-panel/60',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-accent transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden="true"
          />

          <Avatar name={name} seed={room.peer?.id ?? room.id} src={room.peer?.avatarUrl} size="sm" />

          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1 text-sm font-medium text-ink">
                {room.type !== 'DIRECT' ? (
                  <Icon
                    name={room.type === 'PRIVATE' ? 'lock' : 'hash'}
                    size={12}
                    className="shrink-0 text-muted"
                  />
                ) : null}
                <span className="truncate">{name}</span>
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-muted">
                {formatRoomTimestamp(room.lastMessageAt)}
              </span>
            </span>

            <span className="mt-0.5 flex items-center justify-between gap-2">
              <span
                className={cn(
                  'truncate text-xs leading-snug',
                  unread > 0 ? 'font-medium text-ink/85' : 'text-muted',
                )}
              >
                {showSender ? `${last.sender.username}: ` : ''}
                {preview}
              </span>
              {unread > 0 ? (
                <span className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-semibold tabular-nums text-accent-ink">
                  {unread > 99 ? '99+' : unread}
                  <span className="sr-only"> unread messages</span>
                </span>
              ) : null}
            </span>
          </span>
        </>
      )}
    </NavLink>
  );
}
