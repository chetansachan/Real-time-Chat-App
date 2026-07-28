import { useLayoutEffect, useRef, type RefObject } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Spinner } from '@/components/ui/Spinner';
import type { PendingMessage } from '@/stores/pending';
import { formatDayLabel, isSameDay } from '@/lib/utils/format';
import { MessageItem } from './MessageItem';
import type { ChatItem } from './types';

const GROUP_WINDOW_MS = 5 * 60 * 1000;

interface MessageListProps {
  items: ChatItem[];
  firstItemIndex: number;
  currentUserId: string;
  hasOlder: boolean;
  isFetchingOlder: boolean;
  onLoadOlder: () => void;
  onAtBottomChange: (atBottom: boolean) => void;
  onRetry: (message: PendingMessage) => void;
  virtuosoRef: RefObject<VirtuosoHandle | null>;
}

export function MessageList({
  items,
  firstItemIndex,
  currentUserId,
  hasOlder,
  isFetchingOlder,
  onLoadOlder,
  onAtBottomChange,
  onRetry,
  virtuosoRef,
}: MessageListProps) {
  const positioned = useRef(false);

  // `initialTopMostItemIndex` can be ignored when Virtuoso first mounts in a
  // background tab, so anchor to the newest item once the frame is visible.
  useLayoutEffect(() => {
    if (positioned.current || items.length === 0) return;
    const frame = requestAnimationFrame(() => {
      positioned.current = true;
      virtuosoRef.current?.scrollToIndex({ index: 'LAST', align: 'end' });
    });
    return () => cancelAnimationFrame(frame);
  }, [items.length, virtuosoRef]);

  return (
    <Virtuoso<ChatItem>
      ref={virtuosoRef}
      data={items}
      firstItemIndex={firstItemIndex}
      initialTopMostItemIndex={firstItemIndex + Math.max(0, items.length - 1)}
      computeItemKey={(_index, item) => item.key}
      startReached={() => {
        if (hasOlder && !isFetchingOlder) onLoadOlder();
      }}
      atBottomStateChange={onAtBottomChange}
      atBottomThreshold={100}
      followOutput={(isAtBottom) => (isAtBottom ? 'smooth' : false)}
      increaseViewportBy={{ top: 600, bottom: 300 }}
      className="chat-scroll"
      components={{
        Header: () => (
          <div className="flex h-11 items-center justify-center">
            {isFetchingOlder ? (
              <Spinner className="h-4 w-4 text-muted" />
            ) : !hasOlder ? (
              <span className="text-[10px] uppercase tracking-[0.14em] text-muted/70">
                Beginning of conversation
              </span>
            ) : null}
          </div>
        ),
      }}
      itemContent={(index, item) => {
        const localIndex = index - firstItemIndex;
        const previous = localIndex > 0 ? items[localIndex - 1] : undefined;

        const showDate = !previous || !isSameDay(previous.createdAt, item.createdAt);
        const withinWindow = previous
          ? new Date(item.createdAt).getTime() - new Date(previous.createdAt).getTime() <
            GROUP_WINDOW_MS
          : false;
        const showHeader =
          showDate ||
          !previous ||
          previous.senderId !== item.senderId ||
          !withinWindow ||
          item.kind === 'pending';

        return (
          <MessageItem
            item={item}
            isOwn={item.senderId === currentUserId}
            showHeader={showHeader}
            showDate={showDate}
            dateLabel={formatDayLabel(item.createdAt)}
            onRetry={onRetry}
          />
        );
      }}
    />
  );
}
