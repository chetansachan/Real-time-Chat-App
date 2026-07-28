import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { VirtuosoHandle } from 'react-virtuoso';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ApiError } from '@/lib/api/client';
import type { MessageDto } from '@/lib/api/types';
import { useIsWindowActive } from '@/lib/hooks/useIsWindowActive';
import { useNow } from '@/lib/hooks/useNow';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils/cn';
import { errorMessage } from '@/lib/utils/errors';
import { formatTime, roomAudience, roomDisplayName } from '@/lib/utils/format';
import { useAuthStore } from '@/stores/auth';
import { usePendingStore, type PendingMessage } from '@/stores/pending';
import { useUiStore } from '@/stores/ui';
import { leaveRoom } from '@/features/rooms/api';
import { useRoom } from '@/features/rooms/queries';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import type { ChatItem } from './types';
import { useMarkRead } from './useMarkRead';
import { useReconnectCatchUp } from './useReconnectCatchUp';
import { useRoomMessages } from './useRoomMessages';
import { useSendMessage } from './useSendMessage';

const INITIAL_FIRST_INDEX = 1_000_000;
const EMPTY_PENDING: PendingMessage[] = [];

export function ChatView() {
  const { roomId = '' } = useParams();
  // Changing rooms must reset scroll position, pending indexes, and refs.
  return <ChatRoom key={roomId} roomId={roomId} />;
}

function ChatRoom({ roomId }: { roomId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setActiveRoomId = useUiStore((state) => state.setActiveRoomId);
  const user = useAuthStore((state) => state.user);
  const roomQuery = useRoom(roomId);
  const messagesQuery = useRoomMessages(roomId);
  const pending = usePendingStore((state) => state.byRoom[roomId] ?? EMPTY_PENDING);
  const { send, retry } = useSendMessage(roomId);
  const markRead = useMarkRead(roomId);
  const isWindowActive = useIsWindowActive();
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const [atBottom, setAtBottom] = useState(true);
  const [anchorKey, setAnchorKey] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const now = useNow();

  const room = roomQuery.data;

  useEffect(() => {
    setActiveRoomId(roomId);
    return () => setActiveRoomId(null);
  }, [roomId, setActiveRoomId]);

  const history = useMemo(() => {
    const pages = messagesQuery.data?.pages ?? [];
    const seenIds = new Set<string>();
    const seenClientIds = new Set<string>();
    const ordered: MessageDto[] = [];

    for (const page of pages) {
      for (const message of page.items) {
        const clientKey = `${message.senderId}:${message.clientMessageId}`;
        if (seenIds.has(message.id) || seenClientIds.has(clientKey)) continue;
        seenIds.add(message.id);
        seenClientIds.add(clientKey);
        ordered.push(message);
      }
    }

    ordered.reverse();
    return ordered;
  }, [messagesQuery.data]);

  const newestId = history.at(-1)?.id ?? null;
  useReconnectCatchUp(roomId, newestId);

  const items = useMemo<ChatItem[]>(() => {
    const deliveredClientIds = new Set(history.map((message) => message.clientMessageId));
    const pendingItems: ChatItem[] = pending
      .filter((message) => !deliveredClientIds.has(message.clientMessageId))
      .map((message) => ({
        kind: 'pending' as const,
        key: message.clientMessageId,
        createdAt: message.createdAt,
        senderId: user?.id ?? '',
        senderName: user?.username ?? 'You',
        senderAvatar: user?.avatarUrl ?? null,
        pending: message,
      }));

    const sentItems: ChatItem[] = history.map((message) => ({
      kind: 'message' as const,
      key: message.id,
      createdAt: message.createdAt,
      senderId: message.senderId,
      senderName: message.sender.username,
      senderAvatar: message.sender.avatarUrl,
      message,
    }));

    return [...sentItems, ...pendingItems];
  }, [history, pending, user]);

  // Virtuoso needs a stable index space as older pages are prepended.
  const [firstItemIndex, setFirstItemIndex] = useState(INITIAL_FIRST_INDEX);
  const previousFirstId = useRef<string | null>(null);
  useLayoutEffect(() => {
    const firstId = history[0]?.id ?? null;
    const previous = previousFirstId.current;
    if (previous && firstId) {
      const index = history.findIndex((message) => message.id === previous);
      if (index > 0) setFirstItemIndex((value) => value - index);
    }
    previousFirstId.current = firstId;
  }, [history]);

  useEffect(() => {
    if (!isWindowActive || !newestId || !atBottom) return;
    const timer = window.setTimeout(() => markRead(newestId), 500);
    return () => window.clearTimeout(timer);
  }, [isWindowActive, newestId, atBottom, markRead]);

  const lastItemKey = items.at(-1)?.key ?? null;

  // Anchor the newest item when the reader scrolls up; anything after it is new.
  const newCount = useMemo(() => {
    if (anchorKey === null) return 0;
    const anchorIndex = items.findIndex((item) => item.key === anchorKey);
    if (anchorIndex === -1) return 0;
    return items
      .slice(anchorIndex + 1)
      .reduce((count, item) => count + (item.kind === 'message' ? 1 : 0), 0);
  }, [anchorKey, items]);

  const handleAtBottomChange = useCallback(
    (value: boolean) => {
      setAtBottom(value);
      setAnchorKey(value ? null : lastItemKey);
    },
    [lastItemKey],
  );

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' });
    setAnchorKey(null);
  }, []);

  const handleSend = useCallback(
    (content: string) => {
      const sent = send(content);
      if (sent) {
        requestAnimationFrame(() => {
          virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' });
        });
      }
      return sent;
    },
    [send],
  );

  const handleRetry = useCallback(
    (message: PendingMessage) => {
      retry(message);
    },
    [retry],
  );

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = messagesQuery;
  const handleLoadOlder = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const leave = useMutation({
    mutationFn: () => leaveRoom(roomId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.messages(roomId) });
      queryClient.removeQueries({ queryKey: queryKeys.room(roomId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rooms, exact: true });
      navigate('/', { replace: true });
    },
  });

  const name = room ? roomDisplayName(room) : 'Room';
  const audience = room ? roomAudience(room) : '';
  const mutedUntilDate = room?.mutedUntil ? new Date(room.mutedUntil) : null;
  const isMuted = mutedUntilDate ? mutedUntilDate.getTime() > now : false;

  if (roomQuery.isError) {
    const status = roomQuery.error instanceof ApiError ? roomQuery.error.status : 0;
    const denied = status === 403 || status === 404;
    return (
      <div className="flex h-full min-h-0 flex-col bg-canvas">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:px-4">
          <Link
            to="/"
            className="-ml-1 grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-panel hover:text-ink"
            aria-label="Back to conversations"
          >
            <Icon name="chevron-left" size={18} />
          </Link>
          <span className="text-sm font-medium">Room unavailable</span>
        </header>
        <EmptyState
          className="flex-1"
          icon="lock"
          title={denied ? 'No access to this room' : 'Could not open this room'}
          description={
            denied
              ? 'It may be private, or you may have been removed. Ask the owner for an invite.'
              : (errorMessage(roomQuery.error) ?? 'Please try again in a moment.')
          }
          action={<Button onClick={() => navigate('/')}>Back to conversations</Button>}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-canvas">
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line bg-surface/85 px-3 backdrop-blur sm:px-4">
        <Link
          to="/"
          className="-ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-panel hover:text-ink md:hidden"
          aria-label="Back to conversations"
        >
          <Icon name="chevron-left" size={19} />
        </Link>

        {room ? (
          <Avatar name={name} seed={room.peer?.id ?? room.id} src={room.peer?.avatarUrl} size="sm" />
        ) : (
          <Skeleton className="h-9 w-9 rounded-full" />
        )}

        <div className="min-w-0 flex-1">
          {room ? (
            <>
              <h1 className="truncate text-sm font-semibold leading-tight">{name}</h1>
              <p className="truncate text-[11px] text-muted">{audience}</p>
            </>
          ) : (
            <>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-1.5 h-2 w-20" />
            </>
          )}
        </div>

        {room?.role === 'OWNER' ? (
          <span className="hidden rounded-full bg-panel px-2 py-0.5 text-[10px] font-medium text-muted sm:inline">
            Owner
          </span>
        ) : null}

        {room && room.role !== 'OWNER' ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setLeaveOpen(true)}
            aria-label="Leave room"
            title="Leave room"
          >
            <Icon name="logout" size={16} />
          </Button>
        ) : null}
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
          {messagesQuery.isPending ? (
            <MessageSkeleton />
          ) : messagesQuery.isError ? (
            <EmptyState
              className="h-full"
              icon="alert"
              title="Could not load messages"
              description={errorMessage(messagesQuery.error) ?? 'Please try again.'}
              action={
                <Button variant="outline" onClick={() => void messagesQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : items.length === 0 ? (
            <EmptyState
              className="h-full"
              icon="sparkles"
              title="No messages yet"
              description={
                room?.type === 'DIRECT'
                  ? `Say hello to ${name}. Messages appear instantly.`
                  : 'Be the first to say something in this room.'
              }
            />
          ) : (
            <MessageList
              items={items}
              firstItemIndex={firstItemIndex}
              currentUserId={user?.id ?? ''}
              hasOlder={Boolean(hasNextPage)}
              isFetchingOlder={isFetchingNextPage}
              onLoadOlder={handleLoadOlder}
              onAtBottomChange={handleAtBottomChange}
              onRetry={handleRetry}
              virtuosoRef={virtuosoRef}
            />
          )}

          {!atBottom && items.length > 0 && !messagesQuery.isPending ? (
            <button
              type="button"
              onClick={scrollToBottom}
              className="absolute bottom-4 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-surface/95 px-3.5 py-1.5 text-[11px] font-medium text-ink shadow-lg backdrop-blur transition hover:border-accent/50 animate-rise"
              aria-label={
                newCount > 0
                  ? `Scroll to ${newCount} new ${newCount === 1 ? 'message' : 'messages'}`
                  : 'Scroll to latest message'
              }
            >
              <Icon name="arrow-down" size={13} className="text-accent" />
              {newCount > 0
                ? `${newCount} new ${newCount === 1 ? 'message' : 'messages'}`
                : 'Jump to latest'}
            </button>
          ) : null}
        </div>

        {isMuted ? (
          <div className="shrink-0 border-t border-line bg-panel/60 px-4 py-2 text-center text-xs text-muted">
            You&apos;re muted in this room
            {mutedUntilDate ? ` until ${formatTime(mutedUntilDate)}` : ''}.
          </div>
        ) : null}

        <Composer
          onSend={handleSend}
          disabled={!room}
          mutedUntil={room?.mutedUntil ?? null}
        />
      </div>

      <Dialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="Leave this room?"
        description="You will stop receiving its messages. Public rooms can be rejoined from Explore."
      >
        {leave.error ? (
          <p role="alert" className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
            {errorMessage(leave.error)}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setLeaveOpen(false)} disabled={leave.isPending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => leave.mutate()} loading={leave.isPending}>
            Leave room
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-end gap-3 px-4 pb-6">
      {[
        { own: false, width: 'w-56' },
        { own: true, width: 'w-44' },
        { own: false, width: 'w-64' },
        { own: false, width: 'w-48' },
        { own: true, width: 'w-52' },
      ].map((row, index) => (
        <div
          key={index}
          className={cn('flex items-end gap-2.5', row.own ? 'justify-end' : 'justify-start')}
        >
          {!row.own ? <Skeleton className="h-9 w-9 rounded-full" /> : null}
          <Skeleton className={cn('h-10 rounded-2xl', row.width)} />
        </div>
      ))}
    </div>
  );
}
