import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Input';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils/cn';
import { errorMessage } from '@/lib/utils/errors';
import { createRoom } from './api';

const createRoomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give the room a name')
    .max(64, 'Keep the name under 64 characters'),
  type: z.enum(['PUBLIC', 'PRIVATE']),
});

type CreateRoomValues = z.infer<typeof createRoomSchema>;

interface CreateRoomDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateRoomDialog({ open, onClose }: CreateRoomDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateRoomValues>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: { name: '', type: 'PUBLIC' },
  });

  const mutation = useMutation({
    mutationFn: createRoom,
    onSuccess: (room) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rooms, exact: true });
      reset();
      onClose();
      navigate(`/rooms/${room.id}`);
    },
  });

  const type = useWatch({ control, name: 'type' });

  const close = () => {
    reset();
    mutation.reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Create a room"
      description="Public rooms can be discovered. Private rooms are invite-only."
    >
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) =>
          mutation.mutate({ name: values.name.trim(), type: values.type }),
        )}
        noValidate
      >
        <Field label="Room name" htmlFor="room-name" error={errors.name?.message}>
          <Input
            id="room-name"
            placeholder="design-team"
            autoComplete="off"
            aria-invalid={errors.name ? true : undefined}
            {...register('name')}
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted">Visibility</span>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Room visibility">
            {(
              [
                {
                  value: 'PUBLIC' as const,
                  icon: 'hash' as const,
                  title: 'Public',
                  hint: 'Anyone can find and join',
                },
                {
                  value: 'PRIVATE' as const,
                  icon: 'lock' as const,
                  title: 'Private',
                  hint: 'Invite-only',
                },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={type === option.value}
                onClick={() => setValue('type', option.value, { shouldValidate: true })}
                className={cn(
                  'rounded-xl border px-3 py-3 text-left transition',
                  type === option.value
                    ? 'border-accent bg-accent-soft'
                    : 'border-line bg-canvas hover:border-muted/40',
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Icon name={option.icon} size={15} />
                  {option.title}
                </span>
                <span className="mt-1 block text-[11px] leading-snug text-muted">
                  {option.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        {mutation.error ? (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
            {errorMessage(mutation.error)}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={close} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Create room
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
