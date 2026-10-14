import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';

/**
 * A layout route: everything inside it needs a signed-in person. While the session is being restored it shows a
 * neutral blank, so a reload never flashes the login page; a signed-out visitor is sent to /login with the page
 * they asked for, so signing in brings them back to it.
 */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <div aria-busy="true" className="min-h-dvh" />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
