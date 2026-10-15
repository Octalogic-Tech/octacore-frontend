import type { ReactNode } from 'react';
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context';
import { adminUser } from '@/test/fixtures/users';

/** Renders children as a signed-in admin by default; pass `value` to change the status, the user or a method. */
export function AuthTestProvider({ children, value }: { children: ReactNode; value?: Partial<AuthContextValue> }) {
  const context: AuthContextValue = {
    status: 'authenticated',
    user: adminUser,
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    changePassword: vi.fn(async () => undefined),
    ...value,
  };
  return <AuthContext.Provider value={context}>{children}</AuthContext.Provider>;
}
