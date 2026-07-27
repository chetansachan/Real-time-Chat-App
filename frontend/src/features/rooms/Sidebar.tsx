import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useRooms } from '@/features/rooms/queries';
import { useAuthStore } from '@/stores/auth';
import { roomDisplayName } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { CreateRoomDialog } from '@/features/rooms/CreateRoomDialog';
import { NewDmDialog } from '@/features/rooms/NewDmDialog';
import { RoomListItem } from '@/features/rooms/RoomListItem';
import { UserMenu } from '@/features/auth/UserMenu';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const user = useAuthStore((state) => state.user);
  const roomsQuery = useRooms();
  const [filter, setFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const rooms = roomsQuery.data ?? [];
    if (!query) return rooms;
    return rooms.filter((room) => roomDisplayName(room).toLowerCase().includes(query));
  }, [roomsQuery.data, filter]);

  return (
    <aside
      className={cn('relative h-full flex-col border-r border-line bg-surface', className)}
      aria-label="Conversations"
    >
      <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-4">
        <Logo />
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDmOpen(true)}
            aria-label="New direct message"
            title="New direct message"
          >
            <Icon name="message" size={17} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCreateOpen(true)}
            aria-label="Create a room"
            title="Create a room"
          >
            <Icon name="plus" size={18} />
          </Button>
        </div>
      </div>

      <div className="px-3 pt-3">
        <div className="relative">
          <Icon
            name="search"
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="h-9 w-full rounded-lg border border-line bg-canvas pl-8 pr-3 text-xs text-ink transition placeholder:text-muted/70 focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/15"
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pb-1.5 pt-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          Messages
        </span>
        <Link
          to="/explore"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted transition hover:text-accent"
        >
          <Icon name="compass" size={12} />
          Explore
        </Link>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" aria-label="Conversation list">
        {roomsQuery.isPending ? (
          <div className="space-y-1 px-1 pt-1">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 px-1.5 py-2.5">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-2.5 w-1/2" />
                  <Skeleton className="h-2 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : roomsQuery.isError ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-muted">Could not load conversations.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void roomsQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-xs text-muted">
              {filter ? 'No conversations match that search.' : 'No conversations yet.'}
            </p>
            {!filter ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setCreateOpen(true)}
              >
                <Icon name="plus" size={13} />
                Start one
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((room) => (
              <li key={room.id}>
                <RoomListItem room={room} currentUserId={user?.id ?? ''} />
              </li>
            ))}
          </ul>
        )}
      </nav>

      <UserMenu />

      <CreateRoomDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <NewDmDialog open={dmOpen} onClose={() => setDmOpen(false)} />
    </aside>
  );
}
