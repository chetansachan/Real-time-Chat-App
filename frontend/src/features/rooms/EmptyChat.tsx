import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { CreateRoomDialog } from '@/features/rooms/CreateRoomDialog';
import { NewDmDialog } from '@/features/rooms/NewDmDialog';

export function EmptyChat() {
  const [createOpen, setCreateOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden px-6 py-10">
      <div
        className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-accent/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative max-w-md text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-[1.75rem] border border-line bg-surface shadow-xl">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-accent-ink shadow-lg shadow-accent/20">
            <Icon name="message" size={23} />
          </span>
        </div>

        <h1 className="mt-7 font-display text-3xl font-semibold tracking-tight">
          Your conversations, live.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Pick a room from the sidebar or start something new. Messages sync across tabs and
          instances, and history catches up after every reconnect.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <Button size="lg" onClick={() => setCreateOpen(true)}>
            <Icon name="plus" size={16} />
            Create a room
          </Button>
          <Button variant="outline" size="lg" onClick={() => setDmOpen(true)}>
            <Icon name="message" size={16} />
            New message
          </Button>
        </div>

        <Link
          to="/explore"
          className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-accent"
        >
          <Icon name="compass" size={13} />
          Explore public rooms
        </Link>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-muted/70">
          <span>Optimistic sends</span>
          <span aria-hidden="true">·</span>
          <span>Cursor history</span>
          <span aria-hidden="true">·</span>
          <span>Reconnect catch-up</span>
        </div>
      </div>

      <CreateRoomDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <NewDmDialog open={dmOpen} onClose={() => setDmOpen(false)} />
    </div>
  );
}
