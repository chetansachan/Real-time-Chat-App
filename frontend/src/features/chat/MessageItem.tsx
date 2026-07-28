import { memo } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/Icon';
import type { PendingMessage } from '@/stores/pending';
import { cn } from '@/lib/utils/cn';
import { formatTime } from '@/lib/utils/format';
import type { ChatItem } from './types';

interface MessageItemProps {
  item: ChatItem;
  isOwn: boolean;
  showHeader: boolean;
  showDate: boolean;
  dateLabel: string;
  onRetry: (message: PendingMessage) => void;
}

export const MessageItem = memo(function MessageItem({
  item,
  isOwn,
  showHeader,
  showDate,
  dateLabel,
  onRetry,
}: MessageItemProps) {
  const isPending = item.kind === 'pending';
  const failed = isPending && item.pending.status === 'failed';
  const deleted = item.kind === 'message' && item.message.deletedAt !== null;
  const content = item.kind === 'message' ? item.message.content : item.pending.content;

  return (
    <>
      {showDate ? (
        <div className="flex items-center gap-3 px-5 pb-1 pt-5" role="separator" aria-label={dateLabel}>
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
            {dateLabel}
          </span>
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
        </div>
      ) : null}

      <article
        className={cn(
          'flex w-full gap-2.5 px-3 sm:px-5',
          isOwn ? 'justify-end' : 'justify-start',
          showHeader ? 'mt-2.5' : 'mt-0.5',
        )}
        aria-label={`${isOwn ? 'You' : item.senderName} at ${formatTime(item.createdAt)}`}
      >
        {!isOwn ? (
          showHeader ? (
            <Avatar
              name={item.senderName}
              seed={item.senderId}
              src={item.senderAvatar}
              size="sm"
              className="mt-0.5"
            />
          ) : (
            <span className="w-9 shrink-0" aria-hidden="true" />
          )
        ) : null}

        <div
          className={cn(
            'flex max-w-[min(78%,34rem)] flex-col',
            isOwn ? 'items-end' : 'items-start',
          )}
        >
          {showHeader && !isOwn ? (
            <p className="mb-1 px-1 text-[11px] font-medium text-muted">{item.senderName}</p>
          ) : null}

          <div
            className={cn(
              'whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm',
              isOwn
                ? 'rounded-br-md bg-accent text-accent-ink'
                : 'rounded-bl-md border border-line bg-panel text-ink',
              isPending && 'opacity-75',
              failed && 'ring-1 ring-danger/60',
              deleted && 'italic opacity-60',
            )}
          >
            {deleted ? 'Message deleted' : content}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5 px-1 text-[10px] text-muted">
            <time dateTime={item.createdAt}>{formatTime(item.createdAt)}</time>
            {isOwn && !isPending ? (
              <span className="inline-flex items-center gap-0.5 text-accent" title="Sent">
                <Icon name="check-check" size={12} />
                <span className="sr-only">Sent</span>
              </span>
            ) : null}
            {isPending ? (
              item.pending.status === 'sending' ? (
                <span>Sending…</span>
              ) : (
                <span className="inline-flex flex-wrap items-center gap-1.5 text-danger">
                  <span>{item.pending.error ?? 'Failed to send'}</span>
                  <button
                    type="button"
                    onClick={() => onRetry(item.pending)}
                    className="inline-flex items-center gap-0.5 font-semibold underline underline-offset-2 hover:text-danger/80"
                  >
                    <Icon name="refresh" size={10} />
                    Retry
                  </button>
                </span>
              )
            ) : null}
          </div>
        </div>
      </article>
    </>
  );
});
