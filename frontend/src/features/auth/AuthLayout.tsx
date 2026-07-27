import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';

function TypingDots({ delay = 0 }: { delay?: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 rounded-full bg-muted animate-[typing-bounce_1.2s_ease-in-out_infinite]"
          style={{ animationDelay: `${delay + index * 0.15}s` }}
        />
      ))}
    </span>
  );
}

function AuthShowcase() {
  return (
    <div className="relative mt-10 max-w-md">
      <div className="absolute -inset-8 rounded-[2.5rem] bg-accent/10 blur-3xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-3xl border border-line/80 bg-surface/85 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between border-b border-line/70 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-panel font-mono text-sm text-muted">
              #
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight">general</p>
              <p className="text-[11px] text-muted">3 members · 2 online</p>
            </div>
          </div>
          <span className="flex -space-x-1.5" aria-hidden="true">
            <span className="h-6 w-6 rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 ring-2 ring-surface" />
            <span className="h-6 w-6 rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 ring-2 ring-surface" />
            <span className="h-6 w-6 rounded-full bg-gradient-to-br from-rose-400 to-pink-600 ring-2 ring-surface" />
          </span>
        </div>

        <div className="space-y-3 px-4 py-5 text-sm">
          <div className="flex items-end gap-2.5 animate-rise [animation-delay:80ms]">
            <span className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-rose-400 to-pink-600" />
            <div>
              <p className="mb-1 text-[11px] font-medium text-muted">Maya</p>
              <div className="max-w-[15rem] rounded-2xl rounded-bl-md border border-line bg-panel px-3 py-2 leading-relaxed">
                Are we still shipping the lobby redesign tonight?
              </div>
            </div>
          </div>

          <div className="flex justify-end animate-rise [animation-delay:260ms]">
            <div className="max-w-[16rem] rounded-2xl rounded-br-md bg-accent px-3 py-2 leading-relaxed text-accent-ink">
              Already live on staging. Two tabs, zero refreshes 🚀
            </div>
          </div>

          <div className="flex items-end gap-2.5 animate-rise [animation-delay:440ms]">
            <span className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-rose-400 to-pink-600" />
            <div className="rounded-2xl rounded-bl-md border border-line bg-panel px-3 py-2 leading-relaxed">
              Watching it update live is oddly satisfying.
            </div>
          </div>

          <div className="flex items-center gap-2.5 pt-1 animate-fade [animation-delay:700ms]">
            <span className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-rose-400 to-pink-600" />
            <span className="flex items-center gap-2 rounded-full border border-line bg-panel/70 px-3 py-1.5">
              <TypingDots delay={0.7} />
              <span className="text-[11px] text-muted">Maya is typing</span>
            </span>
          </div>

          <div className="flex items-center justify-end gap-1.5 pt-1 text-[11px] text-muted animate-fade [animation-delay:900ms]">
            <span>Seen just now</span>
            <span className="text-accent">✓✓</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-canvas min-h-dvh">
      <div className="mx-auto grid min-h-dvh max-w-6xl grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="relative hidden flex-col justify-between overflow-hidden px-10 py-10 lg:flex xl:px-14">
          <Logo />
          <div className="my-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Realtime, without the refresh button
            </p>
            <h1 className="mt-4 max-w-md font-display text-[2.6rem] font-semibold leading-[1.08] tracking-tight">
              Conversations that keep up with you.
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              Messages land instantly, history pages smoothly, and reconnects never leave a gap.
              Built on Socket.IO with Redis fan-out across instances.
            </p>
            <AuthShowcase />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
            <span>Socket.IO</span>
            <span className="h-1 w-1 rounded-full bg-muted/50" />
            <span>PostgreSQL</span>
            <span className="h-1 w-1 rounded-full bg-muted/50" />
            <span>Redis fan-out</span>
            <span className="h-1 w-1 rounded-full bg-muted/50" />
            <span>TanStack Query</span>
          </div>
        </aside>

        <main className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-sm">
            <div className="mb-9 lg:hidden">
              <Logo />
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
