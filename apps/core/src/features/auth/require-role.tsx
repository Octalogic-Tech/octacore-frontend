import type { ReactNode } from 'react';
import { NotFoundPage } from '@/app/not-found-page';
import { useAuth } from './auth-context';

/**
 * Shows the page only to a person with the role. A convenience: the service enforces roles, so a person who gets
 * past this still cannot read or change anything. It must stay nested inside RequireAuth: it reads only the user, so
 * on its own it would show Not found while the session is still loading, and to a signed-out visitor.
 */
export function RequireRole({ role, children }: { role: string; children: ReactNode }) {
  const { user } = useAuth();
  return user?.role === role ? children : <NotFoundPage />;
}
