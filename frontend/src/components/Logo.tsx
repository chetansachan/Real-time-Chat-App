import { cn } from '@/lib/utils/cn';

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-ink shadow-lg shadow-accent/20">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path d="M5 4h14a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6.2L7 21.2V17H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" />
          <circle cx="8.5" cy="10.5" r="1.15" className="fill-accent" />
          <circle cx="12" cy="10.5" r="1.15" className="fill-accent" />
          <circle cx="15.5" cy="10.5" r="1.15" className="fill-accent" />
        </svg>
      </span>
      {compact ? null : (
        <span className="font-display text-[17px] font-semibold tracking-tight">Relay</span>
      )}
    </div>
  );
}
