import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation } from 'react-router-dom';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { statusOf } from '@/lib/core-api';
import { useAuth } from './auth-context';
import { hasPendingLogout } from './pending-logout';
import { loginSchema, type LoginInput } from './schema';

/** The page RequireAuth saved in router state, or the overview. Never read from the URL, so it cannot be a redirect trick. */
function savedPath(state: unknown): string {
  const from = (state as { from?: { pathname?: string; search?: string } } | null)?.from;
  if (!from?.pathname || from.pathname === '/login') return '/';
  return `${from.pathname}${from.search ?? ''}`;
}

export function LoginPage() {
  const { status, signIn } = useAuth();
  const location = useLocation();
  const [failure, setFailure] = useState<'credentials' | 'unreachable' | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  // Signing in flips the status, which brings the person back to the page they asked for.
  if (status === 'authenticated') return <Navigate to={savedPath(location.state)} replace />;

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await signIn(values.email, values.password);
    } catch (error) {
      setFailure(statusOf(error) === 401 ? 'credentials' : 'unreachable');
    }
  });

  return (
    <main id="main" className="grid min-h-dvh place-items-center px-5 py-12">
      <div className="w-full max-w-md">
        <Logo height={30} />
        <h1 className="mt-10 text-headline font-semibold text-foreground">Sign in</h1>
        <p className="mt-2 text-body text-navy-80">Use the email and password an admin gave you.</p>
        {hasPendingLogout() ? (
          <p className="mt-4 text-small font-semibold text-foreground">
            We could not reach the service to end your last session. Close this browser window to be sure.
          </p>
        ) : null}
        <form onSubmit={submit} noValidate className="mt-8 grid gap-6">
          <Field label="Email" htmlFor="login-email" error={errors.email?.message}>
            <Input
              {...fieldA11y('login-email', errors.email?.message)}
              {...register('email')}
              type="email"
              autoComplete="username"
            />
          </Field>
          <Field label="Password" htmlFor="login-password" error={errors.password?.message}>
            <Input
              {...fieldA11y('login-password', errors.password?.message)}
              {...register('password')}
              type="password"
              autoComplete="current-password"
            />
          </Field>
          {failure ? (
            <p role="alert" className="text-small font-semibold text-foreground">
              {failure === 'credentials'
                ? 'Invalid email or password.'
                : 'We could not sign you in. Check that the API is running, then try again.'}
            </p>
          ) : null}
          <div>
            <Button type="submit" disabled={isSubmitting}>
              Sign in
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
