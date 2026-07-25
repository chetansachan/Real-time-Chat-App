import { useConnectionStore } from '@/stores/connection';

export function ConnectionBanner() {
  const status = useConnectionStore((state) => state.status);

  if (status === 'online' || status === 'idle') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-3 z-50 -translate-x-1/2 animate-rise rounded-full border border-line bg-surface/95 px-3.5 py-1.5 text-[11px] font-medium text-muted shadow-lg backdrop-blur"
    >
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" />
      {status === 'connecting' ? 'Connecting to realtime…' : 'Connection lost — reconnecting…'}
    </div>
  );
}
