import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils/cn';
import { errorMessage } from '@/lib/utils/errors';
import { messagePreview } from '@/lib/utils/format';
import { joinRoom } from './api';
import { usePublicRooms } from './queries';

export function ExplorePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const publicRooms = usePublicRooms(debouncedSearch);

  const join = useMutation({
    mutationFn: joinRoom,
    onSuccess: (room) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rooms, exact: true });
      void queryClient.invalidateQueries({ queryKey: ['rooms', 'public'] });
      navigate(`/rooms/${room.id}`);
    },
  });

  const rooms = publicRooms.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <header className="shrink-0 border-b border-line bg-surface/85 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
          <Link
            to="/"
            className="-ml-1 grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-panel hover:text-ink md:hidden"
            aria-label="Back to conversations"
          >
            <Icon name="chevron-left" size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base font-semibold tracking-tight">Explore rooms</h1>
            <p className="text-[11px] text-muted">Find a public room and jump in.</p>
          </div>
          <Link
            to="/"
            className="hidden text-xs font-medium text-muted transition hover:text-accent md:inline"
          >
            Back to chats
          </Link>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 py-5">
          <div className="relative">
            <Icon
              name="search"
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search public rooms"
              aria-label="Search public rooms"
              className="h-11 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-ink transition placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
            />
          </div>

          {join.error ? (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-xs text-danger"
            >
              {errorMessage(join.error)}
            </p>
          ) : null}

          {publicRooms.isPending ? (
            <ul className="mt-4 space-y-2.5">
              {Array.from({ length: 5 }).map((_, index) => (
                <li
                  key={index}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5"
                >
                  <Skeleton className="h-11 w-11 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-2.5 w-2/3" />
                  </div>
                  <Skeleton className="h-8 w-14 rounded-lg" />
                </li>
              ))}
            </ul>
          ) : publicRooms.isError ? (
            <div className="mt-16">
              <EmptyState
                icon="alert"
                title="Could not load rooms"
                description={errorMessage(publicRooms.error) ?? 'Please try again in a moment.'}
                action={
                  <Button variant="outline" onClick={() => void publicRooms.refetch()}>
                    Try again
                  </Button>
                }
              />
            </div>
          ) : rooms.length === 0 ? (
            <div className="mt-16">
              <EmptyState
                icon="compass"
                title={debouncedSearch ? 'No rooms match' : 'No public rooms yet'}
                description={
                  debouncedSearch
                    ? 'Try a different name, or create the room yourself.'
                    : 'Create a public room and it will show up here.'
                }
              />
            </div>
          ) : (
            <>
              <ul className="mt-4 space-y-2.5">
                {rooms.map((room) => {
                  const name = room.name?.trim() || 'Untitled room';
                  const joining = join.isPending && join.variables === room.id;
                  return (
                    <li
                      key={room.id}
                      className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 transition hover:border-muted/30"
                    >
                      <Avatar name={name} seed={room.id} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Icon name="hash" size={12} className="text-muted" />
                          <p className="truncate text-sm font-medium">{name}</p>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {room.memberCount} {room.memberCount === 1 ? 'member' : 'members'}
                          {room.lastMessage ? ` · ${messagePreview(room.lastMessage)}` : ''}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={room.isMember ? 'secondary' : 'primary'}
                        loading={joining}
                        onClick={() =>
                          room.isMember ? navigate(`/rooms/${room.id}`) : join.mutate(room.id)
                        }
                      >
                        {room.isMember ? 'Open' : 'Join'}
                      </Button>
                    </li>
                  );
                })}
              </ul>

              {publicRooms.hasNextPage ? (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    loading={publicRooms.isFetchingNextPage}
                    onClick={() => void publicRooms.fetchNextPage()}
                    className={cn(publicRooms.isFetchingNextPage && 'opacity-80')}
                  >
                    Load more
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
