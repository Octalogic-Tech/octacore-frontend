import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserRow } from '@/lib/auth-schema';
import { refreshSession } from '@/lib/core-api';
import { endSession, onSessionEnded, onSessionUser, setAccessToken } from '@/lib/session';
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
const LOADING: AuthState = { status: 'loading', user: null };

/** Tabs of the app tell each other about a sign-out on this channel. */
const CHANNEL = 'octacore-auth';
const SIGNED_OUT_MESSAGE = 'signed-out';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>(LOADING);
  // The latest state, for listeners and promises that outlive the render they were created in.
  const current = useRef<AuthState>(LOADING);
  const apply = useCallback((next: AuthState) => {
    current.current = next;
    setState(next);
  }, []);
  const channel = useRef<BroadcastChannel | null>(null);

  // Restore the session from the refresh cookie. `refreshSession` is single-flighted at module level, so
  // StrictMode's double mount in development makes one request, not two. If the last sign-out never reached the
  // service, finish it instead: the cookie still belongs to whoever signed out. The status stays `loading` until
  // that answer is in, so nobody can sign in while its cookie-clearing answer is still on the way. Logout is
  // idempotent, so StrictMode asking twice does no harm. The flag is cleared only once the service has said yes.
  // Whatever comes back is ignored if something else (a sign-in, a session ended) has already settled the status.
  useEffect(() => {
    let active = true;
    const settle = (next: AuthState) => {
      if (active && current.current.status === 'loading') apply(next);
    };
    if (hasPendingLogout()) {
      logout()
        .then(clearPendingLogout, () => undefined)
        .then(() => settle(SIGNED_OUT));
    } else {
      refreshSession().then(
        (session) => settle({ status: 'authenticated', user: session.user }),
        () => settle(SIGNED_OUT),
      );
    }
    return () => {
      active = false;
    };
  }, [apply]);

  // The service refused the refresh cookie mid-use (it expired, the user was deleted), or another tab signed out.
  useEffect(
    () =>
      onSessionEnded(() => {
        queryClient.clear();
        apply(SIGNED_OUT);
      }),
    [queryClient, apply],
  );

  // A refresh says whose session it is. Another person signing in in another tab replaces the shared cookie, so a
  // refresh here can come back as them: drop everything the last person loaded and show who this is now. The same
  // person with changed details (an admin edited their name) just updates what is shown.
  useEffect(
    () =>
      onSessionUser((user) => {
        const shown = current.current;
        if (shown.status !== 'authenticated' || !shown.user) return;
        if (shown.user.id !== user.id) {
          queryClient.clear();
          apply({ status: 'authenticated', user });
        } else if (JSON.stringify(shown.user) !== JSON.stringify(user)) {
          apply({ status: 'authenticated', user });
        }
      }),
    [queryClient, apply],
  );

  // A sign-out in another tab ends the session here too, without asking the service again.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const tabs = new BroadcastChannel(CHANNEL);
    tabs.onmessage = (event: MessageEvent) => {
      if (event.data === SIGNED_OUT_MESSAGE) endSession();
    };
    channel.current = tabs;
    return () => {
      if (channel.current === tabs) channel.current = null;
      tabs.close();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const session = await login(email, password);
      // The new cookie replaced the one a failed sign-out left behind.
      clearPendingLogout();
      apply({ status: 'authenticated', user: session.user });
    },
    [apply],
  );

  const signOut = useCallback(async () => {
    try {
      await logout();
    } catch {
      // Signing out always succeeds locally. The refresh cookie was neither revoked nor cleared, though, so the next
      // load must finish the job before anyone can be signed back in with it.
      markPendingLogout();
    }
    setAccessToken(null);
    // Go to the login page first, with no page to return to: if the status flipped on this page, RequireAuth would
    // record it, and the next person to sign in would land on it.
    navigate('/login', { replace: true });
    apply(SIGNED_OUT);
    // Someone else may sign in next on this browser: nothing the last person loaded may be shown to them.
    queryClient.clear();
    channel.current?.postMessage(SIGNED_OUT_MESSAGE);
  }, [queryClient, navigate, apply]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const session = await requestPasswordChange(currentPassword, newPassword);
      apply({ status: 'authenticated', user: session.user });
    },
    [apply],
  );

  const value = useMemo(
    () => ({ ...state, signIn, signOut, changePassword }),
    [state, signIn, signOut, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
