import { Icon } from '@/components/Icon';
import { useToastStore, type ToastTone } from '@/stores/toast';
import { cn } from '@/lib/utils/cn';

const TONE_CLASSES: Record<ToastTone, string> = {
  default: 'border-line',
  success: 'border-success/40',
  error: 'border-danger/40',
};

const TONE_ICON: Record<ToastTone, 'check' | 'alert' | 'message'> = {
  default: 'message',
  success: 'check',
  error: 'alert',
};

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-5 sm:items-end"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-surface/95 p-3.5 shadow-lg backdrop-blur animate-rise',
            TONE_CLASSES[toast.tone],
          )}
        >
          <span
            className={cn(
              'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full',
              toast.tone === 'error'
                ? 'bg-danger-soft text-danger'
                : toast.tone === 'success'
                  ? 'bg-accent-soft text-accent'
                  : 'bg-panel text-muted',
            )}
          >
            <Icon name={TONE_ICON[toast.tone]} size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug">{toast.title}</p>
            {toast.description ? (
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{toast.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss notification"
            className="-mr-1 -mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted transition hover:bg-panel hover:text-ink"
          >
            <Icon name="x" size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
