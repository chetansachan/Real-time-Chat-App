import { Icon, type IconName } from '@/components/Icon';
import { cn } from '@/lib/utils/cn';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon = 'message', title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 text-center', className)}>
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-panel/60 text-accent">
        <Icon name={icon} size={24} />
      </span>
      <h3 className="mt-4 font-display text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
