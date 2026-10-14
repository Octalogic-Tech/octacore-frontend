import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UserRow } from '@/lib/auth-schema';
import { refreshSession } from '@/lib/core-api';
import { onSessionEnded, setAccessToken } from '@/lib/session';
import { changePassword as requestPasswordChange, login, logout } from './api';
import { clearPendingLogout, hasPendingLogout, markPendingLogout } from './pending-logout';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  user: UserRow | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside an AuthProvider');
  return value;
}

interface AuthState {
  status: AuthStatus;
  user: UserRow | null;
}

const SIGNED_OUT: AuthState = { status: 'anonymous', user: null };

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  // Restore the session from the refresh cookie. `refreshSession` is single-flighted at module level, so
  // StrictMode's double mount in development makes one request, not two. If the last sign-out never reached the
  // service, finish it instead: the cookie still belongs to whoever signed out. The status stays `loading` until
  // that answer is in, so nobody can sign in while its cookie-clearing answer is still on the way. Logout is
  // idempotent, so StrictMode asking twice does no harm. The flag is cleared only once the service has said yes.
  useEffect(() => {
    let active = true;
    if (hasPendingLogout()) {
      logout()
        .then(clearPendingLogout, () => undefined)
        .then(() => {
          if (active) setState(SIGNED_OUT);
        });
      return () => {
        active = false;
      };
    }
    refreshSession().then(
      (session) => {
        if (active) setState({ status: 'authenticated', user: session.user });
      },
      () => {
        if (active) setState(SIGNED_OUT);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  // A refresh that fails mid-use (the cookie expired, the user was deleted) ends the session here.
  useEffect(
    () =>
      onSessionEnded(() => {
        queryClient.clear();
        setState(SIGNED_OUT);
      }),
    [queryClient],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await login(email, password);
    // The new cookie replaced the one a failed sign-out left behind.
    clearPendingLogout();
    setState({ status: 'authenticated', user: session.user });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } catch {
      // Signing out always succeeds locally. The refresh cookie was neither revoked nor cleared, though, so the next
      // load must finish the job before anyone can be signed back in with it.
      markPendingLogout();
    }
    setAccessToken(null);
    setState(SIGNED_OUT);
    // Someone else may sign in next on this browser: nothing the last person loaded may be shown to them.
    queryClient.clear();
  }, [queryClient]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const session = await requestPasswordChange(currentPassword, newPassword);
    setState({ status: 'authenticated', user: session.user });
  }, []);

  const value = useMemo(
    () => ({ ...state, signIn, signOut, changePassword }),
    [state, signIn, signOut, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
