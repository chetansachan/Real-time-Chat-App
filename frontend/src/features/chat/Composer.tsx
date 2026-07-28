import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { useNow } from '@/lib/hooks/useNow';
import { cn } from '@/lib/utils/cn';
import { formatTime } from '@/lib/utils/format';

const MAX_LENGTH = 4000;
const WARN_THRESHOLD = MAX_LENGTH - 400;

interface ComposerProps {
  onSend: (content: string) => boolean;
  disabled?: boolean;
  mutedUntil?: string | null;
}

export function Composer({ onSend, disabled = false, mutedUntil = null }: ComposerProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const now = useNow();

  const mutedUntilDate = mutedUntil ? new Date(mutedUntil) : null;
  const muted = mutedUntilDate ? mutedUntilDate.getTime() > now : false;

  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 168)}px`;
  }, [value]);

  const submit = () => {
    if (disabled) return;
    const content = value.trim();
    if (content.length === 0) return;
    if (onSend(content)) {
      setValue('');
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const placeholder = muted
    ? mutedUntilDate
      ? `Muted until ${formatTime(mutedUntilDate)}`
      : 'You are muted'
    : disabled
      ? 'You cannot send messages in this room'
      : 'Write a message…';

  return (
    <div className="shrink-0 border-t border-line bg-surface px-3 pb-3 pt-2.5 sm:px-4">
      <div
        className={cn(
          'flex items-end gap-2 rounded-2xl border border-line bg-canvas p-1.5 transition focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/10',
          (disabled || muted) && 'opacity-60',
        )}
      >
        <label htmlFor="composer" className="sr-only">
          Message
        </label>
        <textarea
          id="composer"
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={MAX_LENGTH}
          disabled={disabled || muted}
          aria-describedby="composer-hint"
          className="max-h-[168px] min-h-[38px] flex-1 resize-none bg-transparent px-2.5 py-2 text-sm leading-relaxed text-ink placeholder:text-muted/60 focus:outline-none disabled:cursor-not-allowed"
        />
        <div className="flex items-center gap-1.5 pb-0.5 pr-0.5">
          {value.length > WARN_THRESHOLD ? (
            <span
              className={cn(
                'text-[10px] tabular-nums',
                value.length >= MAX_LENGTH ? 'text-danger' : 'text-muted',
              )}
            >
              {value.length}/{MAX_LENGTH}
            </span>
          ) : null}
          <Button
            size="icon-sm"
            onClick={submit}
            disabled={disabled || muted || value.trim().length === 0}
            aria-label="Send message"
            title="Send message"
          >
            <Icon name="send" size={15} />
          </Button>
        </div>
      </div>
      <p id="composer-hint" className="mt-1.5 hidden px-1 text-[10px] text-muted/70 sm:block">
        <kbd className="font-sans font-medium text-muted">Enter</kbd> to send ·{' '}
        <kbd className="font-sans font-medium text-muted">Shift</kbd> +{' '}
        <kbd className="font-sans font-medium text-muted">Enter</kbd> for a new line
      </p>
    </div>
  );
}
