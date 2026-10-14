import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { StrictMode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { coreApi, refreshSession } from '@/lib/core-api';
import { endSession, getAccessToken, setAccessToken } from '@/lib/session';
import { userRows } from '@/test/fixtures/users';
import { envelope, fakeAdapter, sessionEnvelope, type FakeReply } from '@/test/fake-adapter';
import { AuthProvider, useAuth } from './auth-context';

const originalAdapter = coreApi.defaults.adapter;
const PENDING_LOGOUT = 'octacore.pendingLogout';

afterEach(() => {
  coreApi.defaults.adapter = originalAdapter;
  setAccessToken(null);
  window.localStorage.clear();
});

const unauthorized: FakeReply = { status: 401, data: envelope(null, 401) };

/** A service that signs in, refreshes, changes passwords and signs out; any route can be overridden. */
function server(
  overrides: Record<string, FakeReply> = {},
  dynamic: (url: string) => FakeReply | Promise<FakeReply> | undefined = () => undefined,
) {
  return fakeAdapter((config) => {
    const url = config.url ?? '';
    if (overrides[url]) return overrides[url];
    const answer = dynamic(url);
    if (answer) return answer;
    switch (url) {
      case '/auth/refresh':
        return { status: 200, data: sessionEnvelope('refreshed') };
      case '/auth/login':
        return { status: 200, data: sessionEnvelope('logged-in') };
      case '/auth/change-password':
        return { status: 200, data: sessionEnvelope('changed') };
      case '/auth/logout':
        return { status: 200, data: envelope(null) };
      default:
        return { status: 404, data: envelope(null, 404) };
    }
  });
}

/** Every (path, status) pair the provider has rendered, so a test can tell which changed first. */
let rendered: string[] = [];

function Probe() {
  const { status, user, signIn, signOut, changePassword } = useAuth();
  const location = useLocation();
  rendered.push(`${location.pathname} ${status}`);
  return (
    <div>
      <p>status: {status}</p>
      <p>user: {user?.name ?? 'none'}</p>
      <p>
        at {location.pathname}
        {location.state ? ' with state' : ''}
      </p>
      <button onClick={() => void signIn('ada@example.com', 'a long enough password')}>sign in</button>
      <button onClick={() => void signOut()}>sign out</button>
      <button onClick={() => void changePassword('old password 1', 'new password 22')}>change</button>
    </div>
  );
}

beforeEach(() => {
  rendered = [];
});

function mount({ strict = false, route = '/' }: { strict?: boolean; route?: string } = {}) {
  const client = new QueryClient();
  // AuthProvider sits inside the router, as in main.tsx: signing out navigates.
  const tree = (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { client, ...render(strict ? <StrictMode>{tree}</StrictMode> : tree) };
}

describe('AuthProvider', () => {
  it('restores the session from the refresh cookie on mount', async () => {
    coreApi.defaults.adapter = server();
    mount();

    expect(screen.getByText('status: loading')).toBeInTheDocument();
    expect(await screen.findByText('status: authenticated')).toBeInTheDocument();
    expect(screen.getByText('user: Ada Admin')).toBeInTheDocument();
    expect(getAccessToken()).toBe('refreshed');
  });

  it('is signed out when there is no valid refresh cookie', async () => {
    coreApi.defaults.adapter = server({ '/auth/refresh': unauthorized });
    mount();

    expect(await screen.findByText('status: anonymous')).toBeInTheDocument();
    expect(screen.getByText('user: none')).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
  });

  it('is signed out when the service cannot be reached', async () => {
    coreApi.defaults.adapter = server({ '/auth/refresh': { status: 500, data: envelope(null, 500) } });
    mount();

    expect(await screen.findByText('status: anonymous')).toBeInTheDocument();
  });

  it('makes one refresh request under StrictMode, which mounts effects twice', async () => {
    const adapter = server();
    coreApi.defaults.adapter = adapter;
    mount({ strict: true });

    await screen.findByText('status: authenticated');

    expect(adapter.calls.filter((call) => call.url === '/auth/refresh')).toHaveLength(1);
  });

  it('signs in with the email and password and holds the access token', async () => {
    const adapter = server({ '/auth/refresh': unauthorized });
    coreApi.defaults.adapter = adapter;
    const user = userEvent.setup();
    mount();
    await screen.findByText('status: anonymous');

    await user.click(screen.getByRole('button', { name: 'sign in' }));

    expect(await screen.findByText('status: authenticated')).toBeInTheDocument();
    const login = adapter.calls.find((call) => call.url === '/auth/login');
    expect(JSON.parse(login?.data as string)).toEqual({ email: 'ada@example.com', password: 'a long enough password' });
    expect(getAccessToken()).toBe('logged-in');
  });

  it('a failed sign-in leaves the person signed out and lets the caller see the error', async () => {
    coreApi.defaults.adapter = server({ '/auth/refresh': unauthorized, '/auth/login': unauthorized });
    const user = userEvent.setup();
    const errors: unknown[] = [];
    function Catcher() {
      const { signIn } = useAuth();
      return <button onClick={() => signIn('a@b.c', 'x').catch((error) => errors.push(error))}>try</button>;
    }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <AuthProvider>
            <Probe />
            <Catcher />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText('status: anonymous');

    await user.click(screen.getByRole('button', { name: 'try' }));

    await waitFor(() => expect(errors).toHaveLength(1));
    expect(screen.getByText('status: anonymous')).toBeInTheDocument();
  });

  it('signs out: asks the service, drops the token and clears every cached query', async () => {
    const adapter = server();
    coreApi.defaults.adapter = adapter;
    const user = userEvent.setup();
    const { client } = mount();
    await screen.findByText('status: authenticated');
    client.setQueryData(['categories'], [{ id: 1 }]);

    await user.click(screen.getByRole('button', { name: 'sign out' }));

    expect(await screen.findByText('status: anonymous')).toBeInTheDocument();
    expect(adapter.calls.some((call) => call.url === '/auth/logout')).toBe(true);
    expect(getAccessToken()).toBeNull();
    expect(client.getQueryData(['categories'])).toBeUndefined();
  });

  it('still signs out locally when the service cannot be reached', async () => {
    coreApi.defaults.adapter = server({ '/auth/logout': { status: 500, data: envelope(null, 500) } });
    const user = userEvent.setup();
    mount();
    await screen.findByText('status: authenticated');

    await user.click(screen.getByRole('button', { name: 'sign out' }));

    expect(await screen.findByText('status: anonymous')).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
  });

  it('does not leave a pending sign-out behind when the service answers', async () => {
    coreApi.defaults.adapter = server();
    const user = userEvent.setup();
    mount();
    await screen.findByText('status: authenticated');

    await user.click(screen.getByRole('button', { name: 'sign out' }));

    await screen.findByText('status: anonymous');
    expect(window.localStorage.getItem(PENDING_LOGOUT)).toBeNull();
  });

  it('when sign-out cannot reach the service, the next load ends that session instead of restoring it', async () => {
    coreApi.defaults.adapter = server({ '/auth/logout': { status: 500, data: envelope(null, 500) } });
    const user = userEvent.setup();
    const first = mount();
    await screen.findByText('status: authenticated');
    await user.click(screen.getByRole('button', { name: 'sign out' }));
    await screen.findByText('status: anonymous');
    expect(window.localStorage.getItem(PENDING_LOGOUT)).toBe('1');
    first.unmount();

    const adapter = server();
    coreApi.defaults.adapter = adapter;
    mount();

    expect(await screen.findByText('status: anonymous')).toBeInTheDocument();
    expect(adapter.calls.map((call) => call.url)).toEqual(['/auth/logout']);
    expect(window.localStorage.getItem(PENDING_LOGOUT)).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it('keeps the pending sign-out when the logout on load fails too', async () => {
    window.localStorage.setItem(PENDING_LOGOUT, '1');
    const adapter = server({ '/auth/logout': { status: 503, data: envelope(null, 503) } });
    coreApi.defaults.adapter = adapter;
    mount();

    expect(await screen.findByText('status: anonymous')).toBeInTheDocument();
    expect(adapter.calls.map((call) => call.url)).toEqual(['/auth/logout']);
    expect(window.localStorage.getItem(PENDING_LOGOUT)).toBe('1');
  });

  it('signing in clears a pending sign-out: the new cookie replaces the old one', async () => {
    window.localStorage.setItem(PENDING_LOGOUT, '1');
    coreApi.defaults.adapter = server({ '/auth/logout': { status: 503, data: envelope(null, 503) } });
    const user = userEvent.setup();
    mount();
    await screen.findByText('status: anonymous');

    await user.click(screen.getByRole('button', { name: 'sign in' }));

    expect(await screen.findByText('status: authenticated')).toBeInTheDocument();
    expect(window.localStorage.getItem(PENDING_LOGOUT)).toBeNull();
  });

  it('a sign-out that times out still signs out locally, and the request has a 5 second timeout', async () => {
    const adapter = fakeAdapter((config) => {
      if (config.url === '/auth/logout') throw new AxiosError('timeout of 5000ms exceeded', 'ECONNABORTED', config);
      return { status: 200, data: sessionEnvelope('refreshed') };
    });
    coreApi.defaults.adapter = adapter;
    const user = userEvent.setup();
    const { client } = mount();
    await screen.findByText('status: authenticated');
    client.setQueryData(['categories'], [{ id: 1 }]);

    await user.click(screen.getByRole('button', { name: 'sign out' }));

    expect(await screen.findByText('status: anonymous')).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
    expect(client.getQueryData(['categories'])).toBeUndefined();
    expect(window.localStorage.getItem(PENDING_LOGOUT)).toBe('1');
    expect(adapter.calls.find((call) => call.url === '/auth/logout')?.timeout).toBe(5000);
  });

  it('changes the password and carries on with the fresh token', async () => {
    const adapter = server();
    coreApi.defaults.adapter = adapter;
    const user = userEvent.setup();
    mount();
    await screen.findByText('status: authenticated');

    await user.click(screen.getByRole('button', { name: 'change' }));

    await waitFor(() => expect(getAccessToken()).toBe('changed'));
    const call = adapter.calls.find((entry) => entry.url === '/auth/change-password');
    expect(JSON.parse(call?.data as string)).toEqual({
      currentPassword: 'old password 1',
      newPassword: 'new password 22',
    });
    expect(screen.getByText('status: authenticated')).toBeInTheDocument();
  });

  it('moves to signed out and clears the cache when the session ends elsewhere', async () => {
    coreApi.defaults.adapter = server();
    const { client } = mount();
    await screen.findByText('status: authenticated');
    client.setQueryData(['categories'], [{ id: 1 }]);

    act(() => endSession());

    expect(await screen.findByText('status: anonymous')).toBeInTheDocument();
    expect(client.getQueryData(['categories'])).toBeUndefined();
  });

  it('sign-out goes to the login page, with no page to return to, before it shows anyone as signed out', async () => {
    coreApi.defaults.adapter = server();
    const user = userEvent.setup();
    mount({ route: '/clients' });
    await screen.findByText('status: authenticated');

    await user.click(screen.getByRole('button', { name: 'sign out' }));

    expect(await screen.findByText('status: anonymous')).toBeInTheDocument();
    expect(screen.getByText('at /login')).toBeInTheDocument();
    // Never "signed out on the previous person's page", which is what lets RequireAuth record that page.
    expect(rendered).not.toContain('/clients anonymous');
  });

  it('a sign-out in another tab signs this one out too, without asking the service again', async () => {
    const adapter = server();
    coreApi.defaults.adapter = adapter;
    const { client } = mount();
    await screen.findByText('status: authenticated');
    client.setQueryData(['categories'], [{ id: 1 }]);
    const otherTab = new BroadcastChannel('octacore-auth');

    try {
      otherTab.postMessage('signed-out');

      expect(await screen.findByText('status: anonymous')).toBeInTheDocument();
      expect(getAccessToken()).toBeNull();
      expect(client.getQueryData(['categories'])).toBeUndefined();
      expect(adapter.calls.map((call) => call.url)).toEqual(['/auth/refresh']);
    } finally {
      otherTab.close();
    }
  });

  it('tells the other tabs when it signs out', async () => {
    coreApi.defaults.adapter = server();
    const user = userEvent.setup();
    mount();
    await screen.findByText('status: authenticated');
    const otherTab = new BroadcastChannel('octacore-auth');
    const heard = new Promise((resolve) => {
      otherTab.onmessage = (event) => resolve(event.data);
    });

    try {
      await user.click(screen.getByRole('button', { name: 'sign out' }));

      expect(await heard).toBe('signed-out');
    } finally {
      otherTab.close();
    }
  });

  it('a refresh that comes back as someone else clears the cache and shows the new person', async () => {
    let refreshes = 0;
    coreApi.defaults.adapter = server({}, (url) => {
      if (url !== '/auth/refresh') return undefined;
      refreshes += 1;
      return { status: 200, data: envelope({ accessToken: 'grace', expiresIn: 900, user: refreshes === 1 ? userRows[0] : userRows[1] }) };
    });
    const { client } = mount();
    await screen.findByText('user: Ada Admin');
    client.setQueryData(['categories'], [{ id: 1 }]);

    await act(async () => {
      await refreshSession();
    });

    expect(await screen.findByText('user: Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('status: authenticated')).toBeInTheDocument();
    expect(client.getQueryData(['categories'])).toBeUndefined();
  });

  it('a refresh that comes back as the same person with new details updates them, and keeps the cache', async () => {
    let refreshes = 0;
    coreApi.defaults.adapter = server({}, (url) => {
      if (url !== '/auth/refresh') return undefined;
      refreshes += 1;
      const user = refreshes === 1 ? userRows[0] : { ...userRows[0], name: 'Ada Lovelace' };
      return { status: 200, data: envelope({ accessToken: 'again', expiresIn: 900, user }) };
    });
    const { client } = mount();
    await screen.findByText('user: Ada Admin');
    client.setQueryData(['categories'], [{ id: 1 }]);

    await act(async () => {
      await refreshSession();
    });

    expect(await screen.findByText('user: Ada Lovelace')).toBeInTheDocument();
    expect(client.getQueryData(['categories'])).toEqual([{ id: 1 }]);
  });

  it('a slow restore that fails afterwards does not undo a sign-in that already happened', async () => {
    let failRestore: () => void = () => undefined;
    coreApi.defaults.adapter = server({}, (url) => {
      if (url !== '/auth/refresh') return undefined;
      return new Promise((resolve) => {
        failRestore = () => resolve(unauthorized);
      });
    });
    const user = userEvent.setup();
    mount();
    expect(screen.getByText('status: loading')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'sign in' }));
    await screen.findByText('status: authenticated');
    await act(async () => {
      failRestore();
      await Promise.resolve();
    });

    expect(screen.getByText('status: authenticated')).toBeInTheDocument();
    expect(screen.getByText('user: Ada Admin')).toBeInTheDocument();
  });
});
