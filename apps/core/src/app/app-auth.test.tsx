import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuthProvider, type AuthContextValue } from '@/features/auth/auth-context';
import { coreApi } from '@/lib/core-api';
import { setAccessToken } from '@/lib/session';
import { AuthTestProvider } from '@/test/auth';
import { adminUser } from '@/test/fixtures/users';
import { envelope, fakeAdapter, sessionEnvelope } from '@/test/fake-adapter';
import App from './app';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn().mockResolvedValue({ data: [] }), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const originalAdapter = coreApi.defaults.adapter;

// The Users page calls coreApi: answer it here so no request leaves the test (the deep-link test installs its own).
beforeEach(() => {
  coreApi.defaults.adapter = fakeAdapter(() => ({ status: 200, data: envelope([]) }));
});

afterEach(() => {
  coreApi.defaults.adapter = originalAdapter;
  setAccessToken(null);
});

function Where() {
  const { pathname, search } = useLocation();
  return (
    <p>
      at {pathname}
      {search}
    </p>
  );
}

function renderWithContext(route: string, value: Partial<AuthContextValue>) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthTestProvider value={value}>
        <MemoryRouter initialEntries={[route]}>
          <App />
          <Where />
        </MemoryRouter>
      </AuthTestProvider>
    </QueryClientProvider>,
  );
}

describe('the app behind sign-in', () => {
  it.each(['/', '/clients', '/finance/receipts-bills', '/nope'])(
    'sends a signed-out visitor from %s to the login page, with no navigation',
    async (route) => {
      renderWithContext(route, { status: 'anonymous', user: null });
      expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
      expect(screen.getByText('at /login')).toBeInTheDocument();
    },
  );

  it('shows nothing while the session is being restored', () => {
    renderWithContext('/clients', { status: 'loading', user: null });
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('sends a signed-in person away from the login page to the overview', async () => {
    renderWithContext('/login', {});
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText('at /')).toBeInTheDocument();
  });

  it('brings a visitor back to the deep link they followed, query string included, after signing in', async () => {
    coreApi.defaults.adapter = fakeAdapter((config) => {
      if (config.url === '/auth/refresh') return { status: 401, data: envelope(null, 401) };
      if (config.url === '/auth/login') return { status: 200, data: sessionEnvelope('logged-in') };
      return { status: 200, data: envelope([]) };
    });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/clients?q=acme']}>
          <AuthProvider>
            <App />
            <Where />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'a long enough password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Clients' })).toBeInTheDocument();
    expect(screen.getByText('at /clients?q=acme')).toBeInTheDocument();
  });

  it('after a sign-out, the next person to sign in lands on the overview, not on the page the last one was on', async () => {
    let signedIn = true;
    coreApi.defaults.adapter = fakeAdapter((config) => {
      if (config.url === '/auth/refresh') {
        return signedIn ? { status: 200, data: sessionEnvelope('restored') } : { status: 401, data: envelope(null, 401) };
      }
      if (config.url === '/auth/logout') {
        signedIn = false;
        return { status: 200, data: envelope(null) };
      }
      if (config.url === '/auth/login') return { status: 200, data: sessionEnvelope('logged-in') };
      return { status: 200, data: envelope([]) };
    });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/clients?q=acme']}>
          <AuthProvider>
            <App />
            <Where />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Clients' })).toBeInTheDocument();

    // The desktop sidebar and the phone menu both hold an account block; either signs out.
    await user.click(screen.getAllByRole('button', { name: 'Sign out' })[0]);
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Email'), 'grace@example.com');
    await user.type(screen.getByLabelText('Password'), 'a long enough password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText('at /')).toBeInTheDocument();
  });

  it('shows the Admin group and the Users page to an admin', async () => {
    renderWithContext('/users', {});
    expect(await screen.findByRole('heading', { level: 1, name: 'Users' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByText('Admin')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page');
  });

  it('hides the Admin group and the Users page from a person who is not an admin', async () => {
    renderWithContext('/users', { user: { ...adminUser, role: 'viewer' } });
    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).queryByText('Admin')).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  });
});
