import { Logo } from '@/components/Logo';
import { Skeleton } from '@/components/ui/Skeleton';

export function SplashScreen() {
  return (
    <div className="auth-canvas flex min-h-dvh flex-col items-center justify-center gap-6">
      <div className="animate-rise">
        <Logo />
      </div>
      <div className="flex w-40 flex-col items-center gap-2">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Restoring session</p>
      </div>
    </div>
  );
}
