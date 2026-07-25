import { cn } from '@/lib/utils/cn';
import { avatarGradient, initials } from '@/lib/utils/avatar';

const SIZES = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
} as const;

interface AvatarProps {
  name: string;
  seed?: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

export function Avatar({ name, seed, src, size = 'md', className }: AvatarProps) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold text-white ring-1 ring-black/10 dark:ring-white/10',
        SIZES[size],
        !src && avatarGradient(seed ?? name),
        className,
      )}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials(name)}
    </span>
  );
}
