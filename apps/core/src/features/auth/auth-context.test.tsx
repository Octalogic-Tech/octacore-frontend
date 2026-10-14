import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { coreApi } from '@/lib/core-api';
import { endSession, getAccessToken, setAccessToken } from '@/lib/session';
import { envelope, fakeAdapter, sessionEnvelope, type FakeReply } from '@/test/fake-adapter';
import { AuthProvider, useAuth } from './auth-context';

const originalAdapter = coreApi.defaults.adapter;

afterEach(() => {
  coreApi.defaults.adapter = originalAdapter;
  setAccessToken(null);
});

const unauthorized: FakeReply = { status: 401, data: envelope(null, 401) };

/** A service that signs in, refreshes, changes passwords and signs out; any route can be overridden. */
function server(overrides: Record<string, FakeReply> = {}) {
  return fakeAdapter((config) => {
    const url = config.url ?? '';
    if (overrides[url]) return overrides[url];
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

function Probe() {
  const { status, user, signIn, signOut, changePassword } = useAuth();
  return (
    <div>
      <p>status: {status}</p>
      <p>user: {user?.name ?? 'none'}</p>
      <button onClick={() => void signIn('ada@example.com', 'a long enough password')}>sign in</button>
      <button onClick={() => void signOut()}>sign out</button>
      <button onClick={() => void changePassword('old password 1', 'new password 22')}>change</button>
    </div>
  );
}

function mount({ strict = false }: { strict?: boolean } = {}) {
  const client = new QueryClient();
  const tree = (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
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
        <AuthProvider>
          <Probe />
          <Catcher />
        </AuthProvider>
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
});
