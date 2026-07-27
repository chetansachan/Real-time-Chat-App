import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth';
import { AuthLayout } from './AuthLayout';
import { loginRequest } from './api';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginValues = z.infer<typeof loginSchema>;

interface LocationState {
  from?: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const redirectTo = state?.from && state.from.startsWith('/') ? state.from : '/';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const login = useMutation({
    mutationFn: loginRequest,
    onSuccess: (session) => {
      useAuthStore.getState().setSession(session);
      navigate(redirectTo, { replace: true });
    },
  });

  const errorMessage =
    login.error instanceof ApiError
      ? login.error.message
      : login.error
        ? 'Could not sign in. Please try again.'
        : null;

  const submit = handleSubmit((values) => {
    login.mutate(values);
  });

  return (
    <AuthLayout>
      <div className="mb-7">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted">Sign in to pick up where you left off.</p>
      </div>

      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={errors.email ? true : undefined}
            {...register('email')}
          />
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={errors.password ? true : undefined}
            {...register('password')}
          />
        </Field>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-3 text-sm text-danger"
          >
            <Icon name="alert" size={16} className="mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
          Sign in
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        New here?{' '}
        <Link to="/register" className="font-medium text-accent hover:underline">
          Create an account
        </Link>
      </p>

      <div className="mt-8 rounded-xl border border-dashed border-line px-3.5 py-3 text-xs text-muted">
        <div className="flex items-center justify-between gap-3">
          <span>
            Demo: <span className="font-mono text-[11px] text-ink">alice@example.com</span> /{' '}
            <span className="font-mono text-[11px] text-ink">Password123!</span>
          </span>
          <button
            type="button"
            className="shrink-0 font-medium text-accent hover:underline"
            onClick={() => {
              setValue('email', 'alice@example.com', { shouldValidate: true });
              setValue('password', 'Password123!', { shouldValidate: true });
            }}
          >
            Fill
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
