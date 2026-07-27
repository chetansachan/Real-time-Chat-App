import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="auth-canvas flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <Logo />
      <EmptyState
        icon="compass"
        title="Page not found"
        description="The page you followed does not exist. Head back to your conversations."
        action={<Button onClick={() => navigate('/')}>Back to chats</Button>}
      />
    </div>
  );
}
