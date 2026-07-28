import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import { queryKeys } from '@/lib/query/keys';
import { errorMessage } from '@/lib/utils/errors';
import { useUserSearch } from './queries';
import { createDirectRoom } from './api';

interface NewDmDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewDmDialog({ open, onClose }: NewDmDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const users = useUserSearch(debouncedSearch);

  const mutation = useMutation({
    mutationFn: createDirectRoom,
    onSuccess: (room) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rooms, exact: true });
      setSearch('');
      onClose();
      navigate(`/rooms/${room.id}`);
    },
  });

  const close = () => {
    setSearch('');
    mutation.reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="New direct message"
      description="Search for someone by username to open a private conversation."
    >
      <div className="relative">
        <Icon
          name="search"
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search people"
          aria-label="Search people"
          className="pl-9"
          autoFocus
        />
      </div>

      <div className="mt-3 max-h-64 min-h-24 overflow-y-auto">
        {users.isPending ? (
          <div className="grid h-24 place-items-center text-muted">
            <Spinner className="h-5 w-5" />
          </div>
        ) : users.isError ? (
          <p role="alert" className="px-2 py-4 text-sm text-danger">
            {errorMessage(users.error)}
          </p>
        ) : users.data && users.data.length > 0 ? (
          <ul className="space-y-1">
            {users.data.map((user) => {
              const isStarting = mutation.isPending && mutation.variables === user.id;
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => mutation.mutate(user.id)}
                    disabled={mutation.isPending}
                    className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-panel disabled:opacity-60"
                  >
                    <Avatar name={user.username} seed={user.id} src={user.avatarUrl} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{user.username}</span>
                      <span className="block text-[11px] text-muted">Direct message</span>
                    </span>
                    {isStarting ? (
                      <Spinner className="h-4 w-4 text-muted" />
                    ) : (
                      <Icon name="message" size={15} className="text-muted" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-2 py-8 text-center text-sm text-muted">
            {debouncedSearch ? 'No people match that search.' : 'No other accounts yet.'}
          </div>
        )}
      </div>

      {mutation.error ? (
        <p role="alert" className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
          {errorMessage(mutation.error)}
        </p>
      ) : null}
    </Dialog>
  );
}
