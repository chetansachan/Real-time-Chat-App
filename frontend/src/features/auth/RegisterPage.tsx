import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth';
import { AuthLayout } from './AuthLayout';
import { registerRequest } from './api';

const registerSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  username: z
    .string()
    .trim()
    .min(3, 'Use at least 3 characters')
    .max(32, 'Use at most 32 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(128, 'Use at most 128 characters'),
});

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', username: '', password: '' },
  });

  const signUp = useMutation({
    mutationFn: registerRequest,
    onSuccess: (session) => {
      useAuthStore.getState().setSession(session);
      navigate('/', { replace: true });
    },
  });

  const errorMessage =
    signUp.error instanceof ApiError
      ? signUp.error.message
      : signUp.error
        ? 'Could not create your account. Please try again.'
        : null;

  return (
    <AuthLayout>
      <div className="mb-7">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1.5 text-sm text-muted">
          Join a room, open a DM, and start chatting in seconds.
        </p>
      </div>

      <form onSubmit={handleSubmit((values) => signUp.mutate(values))} className="space-y-4" noValidate>
        <Field
          label="Username"
          htmlFor="username"
          error={errors.username?.message}
          hint="Letters, numbers, and underscores."
        >
          <Input
            id="username"
            autoComplete="username"
            placeholder="maya"
            aria-invalid={errors.username ? true : undefined}
            {...register('username')}
          />
        </Field>

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
            autoComplete="new-password"
            placeholder="At least 8 characters"
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

        <Button type="submit" size="lg" className="w-full" loading={signUp.isPending}>
          Create account
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
