import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthTestProvider } from '@/test/auth';
import { adminUser } from '@/test/fixtures/users';
import type { AuthContextValue } from './auth-context';
import { RequireAuth } from './require-auth';
import { RequireRole } from './require-role';

function LoginProbe() {
  const { state } = useLocation();
  const from = (state as { from?: { pathname: string; search: string } } | null)?.from;
  return <p>login screen, from {from ? `${from.pathname}${from.search}` : 'nowhere'}</p>;
}

function renderRoutes(route: string, value: Partial<AuthContextValue> = {}) {
  return render(
    <AuthTestProvider value={value}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<p>home screen</p>} />
            <Route
              path="/users"
              element={
                <RequireRole role="admin">
                  <p>users screen</p>
                </RequireRole>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthTestProvider>,
  );
}

describe('RequireAuth', () => {
  it('lets a signed-in person through', () => {
    renderRoutes('/');
    expect(screen.getByText('home screen')).toBeInTheDocument();
  });

  it('sends a signed-out visitor to the login page and remembers the page, query string included', () => {
    renderRoutes('/users?q=ada', { status: 'anonymous', user: null });
    expect(screen.getByText('login screen, from /users?q=ada')).toBeInTheDocument();
  });

  it('shows neither the page nor the login page while the session is being restored', () => {
    const { container } = renderRoutes('/', { status: 'loading', user: null });
    expect(screen.queryByText('home screen')).not.toBeInTheDocument();
    expect(screen.queryByText(/login screen/)).not.toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});

describe('RequireRole', () => {
  it('shows the page to a person with the role', () => {
    renderRoutes('/users');
    expect(screen.getByText('users screen')).toBeInTheDocument();
  });

  it('shows the not-found page to a signed-in person without it', () => {
    renderRoutes('/users', { user: { ...adminUser, id: 7, name: 'Vera Viewer', role: 'viewer' } });
    expect(screen.queryByText('users screen')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
  });
});
