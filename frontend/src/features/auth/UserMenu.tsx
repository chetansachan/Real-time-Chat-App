import { useAuthStore } from '@/stores/auth';
import { useConnectionStore } from '@/stores/connection';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Icon } from '@/components/Icon';
import { cn } from '@/lib/utils/cn';
import { useLogout } from '@/features/auth/useLogout';

const STATUS_LABEL = {
  idle: 'Offline',
  connecting: 'Connecting…',
  online: 'Online',
  offline: 'Connection lost',
} as const;

const STATUS_DOT = {
  idle: 'bg-muted',
  connecting: 'bg-amber-400 animate-pulse',
  online: 'bg-success',
  offline: 'bg-danger',
} as const;

export function UserMenu() {
  const user = useAuthStore((state) => state.user);
  const status = useConnectionStore((state) => state.status);
  const logout = useLogout();

  if (!user) return null;

  const label = STATUS_LABEL[status];

  return (
    <div className="border-t border-line p-2.5">
      <div className="flex items-center gap-2 rounded-xl px-2 py-1.5">
        <Avatar name={user.username} seed={user.id} src={user.avatarUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight" title={user.email}>
            {user.username}
          </p>
          <p className="flex items-center gap-1.5 text-[10px] text-muted">
            <span
              className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])}
              role="status"
              aria-label={label}
              title={label}
            />
            <span>{label}</span>
          </p>
        </div>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => logout.mutate()}
          loading={logout.isPending}
          aria-label="Sign out"
          title="Sign out"
        >
          <Icon name="logout" size={16} />
        </Button>
      </div>
    </div>
  );
}
