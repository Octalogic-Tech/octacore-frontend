import { api } from '@/lib/api';
import { AxiosError } from 'axios';
import { userRows } from '@/test/fixtures/users';
import { envelope, fakeAdapter, sessionEnvelope, type FakeAdapter } from '@/test/fake-adapter';
import { coreApi, refreshSession } from './core-api';
import { getAccessToken, onSessionEnded, onSessionUser, setAccessToken } from './session';

const coreAdapter = coreApi.defaults.adapter;
const mockAdapter = api.defaults.adapter;

beforeEach(() => setAccessToken(null));

afterEach(() => {
  coreApi.defaults.adapter = coreAdapter;
  api.defaults.adapter = mockAdapter;
  setAccessToken(null);
});

const refreshCalls = (adapter: FakeAdapter) => adapter.calls.filter((call) => call.url === '/auth/refresh');

/** A server that only accepts the token it hands out on refresh ('new'), after a short delay. */
const serverAcceptingNewToken = () =>
  fakeAdapter(async (config) => {
    if (config.url === '/auth/refresh') {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { status: 200, data: sessionEnvelope('new') };
    }
    return config.headers.get('Authorization') === 'Bearer new'
      ? { status: 200, data: envelope(['ok']) }
      : { status: 401, data: envelope(null, 401) };
  });

describe('coreApi', () => {
  it('sends credentials, so the refresh cookie travels', () => {
    expect(coreApi.defaults.withCredentials).toBe(true);
  });

  it('sends the access token as a bearer token', async () => {
    const adapter = fakeAdapter(() => ({ status: 200, data: envelope([]) }));
    coreApi.defaults.adapter = adapter;
    setAccessToken('abc');

    await coreApi.get('/categories');

    expect(adapter.calls[0].headers.get('Authorization')).toBe('Bearer abc');
  });

  it('sends no Authorization header while signed out', async () => {
    const adapter = fakeAdapter(() => ({ status: 200, data: envelope([]) }));
    coreApi.defaults.adapter = adapter;

    await coreApi.get('/categories');

    expect(adapter.calls[0].headers.get('Authorization')).toBeFalsy();
  });

  it('a request that carried a token before the session ended goes out without it', async () => {
    const adapter = fakeAdapter(() => ({ status: 200, data: envelope([]) }));
    coreApi.defaults.adapter = adapter;

    // What a retry looks like: the same config, still holding the header stamped on its first attempt.
    await coreApi.get('/categories', { headers: { Authorization: 'Bearer stale' } });

    expect(adapter.calls[0].headers.get('Authorization')).toBeFalsy();
  });

  it('never sends the token to the json-server mock', async () => {
    const adapter = fakeAdapter(() => ({ status: 200, data: [] }));
    api.defaults.adapter = adapter;
    setAccessToken('abc');

    await api.get('/bills');

    expect(adapter.calls[0].headers.get('Authorization')).toBeFalsy();
  });

  it('refreshes once and retries a request that came back 401', async () => {
    setAccessToken('old');
    const adapter = serverAcceptingNewToken();
    coreApi.defaults.adapter = adapter;

    const response = await coreApi.get('/categories');

    expect(response.data.data).toEqual(['ok']);
    expect(adapter.calls.map((call) => call.url)).toEqual(['/categories', '/auth/refresh', '/categories']);
    expect(getAccessToken()).toBe('new');
  });

  it('shares one refresh between requests that fail together', async () => {
    setAccessToken('old');
    const adapter = serverAcceptingNewToken();
    coreApi.defaults.adapter = adapter;

    await Promise.all([coreApi.get('/categories'), coreApi.get('/technologies')]);

    expect(refreshCalls(adapter)).toHaveLength(1);
  });

  it('treats /auth/change-password like any protected request: refresh once and retry', async () => {
    setAccessToken('old');
    const adapter = fakeAdapter((config) => {
      if (config.url === '/auth/refresh') return { status: 200, data: sessionEnvelope('new') };
      return config.headers.get('Authorization') === 'Bearer new'
        ? { status: 200, data: sessionEnvelope('changed') }
        : { status: 401, data: envelope(null, 401) };
    });
    coreApi.defaults.adapter = adapter;

    await coreApi.post('/auth/change-password', { currentPassword: 'a', newPassword: 'b' });

    expect(adapter.calls.map((call) => call.url)).toEqual([
      '/auth/change-password',
      '/auth/refresh',
      '/auth/change-password',
    ]);
    // The retry replays the body it was first sent with.
    expect(adapter.calls[2].data).toEqual(adapter.calls[0].data);
  });

  it('ends the session when the refresh itself fails, and rejects with the original 401', async () => {
    const ended = vi.fn();
    const off = onSessionEnded(ended);
    setAccessToken('old');
    coreApi.defaults.adapter = fakeAdapter(() => ({ status: 401, data: envelope(null, 401) }));

    await expect(coreApi.get('/categories')).rejects.toMatchObject({ response: { status: 401 } });

    expect(ended).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
    off();
  });

  it.each([
    ['a 500', () => ({ status: 500, data: envelope(null, 500) })],
    [
      'a network error',
      (config: Parameters<Parameters<typeof fakeAdapter>[0]>[0]) => {
        throw new AxiosError('Network Error', 'ERR_NETWORK', config);
      },
    ],
  ] as const)('keeps the session when the refresh fails with %s, and rejects with the original 401', async (_, refreshAnswer) => {
    const ended = vi.fn();
    const off = onSessionEnded(ended);
    setAccessToken('old');
    coreApi.defaults.adapter = fakeAdapter((config) =>
      config.url === '/auth/refresh' ? refreshAnswer(config) : { status: 401, data: envelope(null, 401) },
    );

    await expect(coreApi.get('/categories')).rejects.toMatchObject({
      config: { url: '/categories' },
      response: { status: 401 },
    });

    expect(ended).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe('old');
    off();
  });

  it.each(['/auth/login', '/auth/refresh', '/auth/logout'])('does not try to refresh after a 401 from %s', async (path) => {
    const adapter = fakeAdapter(() => ({ status: 401, data: envelope(null, 401) }));
    coreApi.defaults.adapter = adapter;

    await expect(coreApi.post(path, {})).rejects.toMatchObject({ response: { status: 401 } });

    expect(adapter.calls.map((call) => call.url)).toEqual([path]);
  });

  it('retries a request at most once, so a server that keeps answering 401 cannot loop', async () => {
    setAccessToken('old');
    const adapter = fakeAdapter((config) =>
      config.url === '/auth/refresh'
        ? { status: 200, data: sessionEnvelope('new') }
        : { status: 401, data: envelope(null, 401) },
    );
    coreApi.defaults.adapter = adapter;

    await expect(coreApi.get('/categories')).rejects.toMatchObject({ response: { status: 401 } });

    expect(adapter.calls.map((call) => call.url)).toEqual(['/categories', '/auth/refresh', '/categories']);
  });

  it('does not touch errors that are not a 401', async () => {
    coreApi.defaults.adapter = fakeAdapter(() => ({ status: 409, data: envelope(null, 409) }));

    await expect(coreApi.get('/categories')).rejects.toMatchObject({ response: { status: 409 } });
  });
});

describe('refreshSession', () => {
  it('shares one request between callers that overlap, and stores the new token', async () => {
    const adapter = serverAcceptingNewToken();
    coreApi.defaults.adapter = adapter;

    const [first, second] = await Promise.all([refreshSession(), refreshSession()]);

    expect(refreshCalls(adapter)).toHaveLength(1);
    expect(first).toBe(second);
    expect(first.user.email).toBe('ada@example.com');
    expect(getAccessToken()).toBe('new');
  });

  it('makes a new request once the first has finished', async () => {
    const adapter = serverAcceptingNewToken();
    coreApi.defaults.adapter = adapter;

    await refreshSession();
    await refreshSession();

    expect(refreshCalls(adapter)).toHaveLength(2);
  });

  it('rejects and leaves the token alone when the cookie is refused', async () => {
    setAccessToken('keep');
    coreApi.defaults.adapter = fakeAdapter(() => ({ status: 401, data: envelope(null, 401) }));

    await expect(refreshSession()).rejects.toMatchObject({ response: { status: 401 } });

    expect(getAccessToken()).toBe('keep');
  });

  it('does not keep a token whose refresh finished after the session was dropped (a sign-out mid-refresh)', async () => {
    setAccessToken('old');
    coreApi.defaults.adapter = serverAcceptingNewToken();

    const pending = refreshSession();
    setAccessToken(null);

    await expect(pending).rejects.toThrow('The session ended while it was being refreshed');
    expect(getAccessToken()).toBeNull();
  });

  it('tells subscribers who the new session belongs to', async () => {
    const listener = vi.fn();
    const off = onSessionUser(listener);
    coreApi.defaults.adapter = serverAcceptingNewToken();

    await refreshSession();

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ id: userRows[0].id, email: userRows[0].email }));
    off();
  });

  it('rejects an answer that is not a session', async () => {
    coreApi.defaults.adapter = fakeAdapter(() => ({ status: 200, data: envelope({ nope: true }) }));

    await expect(refreshSession()).rejects.toThrow();
  });
});
