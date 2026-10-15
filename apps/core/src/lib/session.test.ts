import { userRows } from '@/test/fixtures/users';
import {
  endSession,
  getAccessToken,
  getSessionGeneration,
  notifySessionUser,
  onSessionEnded,
  onSessionUser,
  setAccessToken,
} from './session';

afterEach(() => setAccessToken(null));

describe('session', () => {
  it('holds the access token in memory only, never in browser storage', () => {
    setAccessToken('abc');

    expect(getAccessToken()).toBe('abc');
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('endSession drops the token and tells every listener', () => {
    const first = vi.fn();
    const second = vi.fn();
    const offFirst = onSessionEnded(first);
    const offSecond = onSessionEnded(second);
    setAccessToken('abc');

    endSession();

    expect(getAccessToken()).toBeNull();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    offFirst();
    offSecond();
  });

  it('stops telling a listener that unsubscribed', () => {
    const listener = vi.fn();
    onSessionEnded(listener)();

    endSession();

    expect(listener).not.toHaveBeenCalled();
  });

  it('starts a new generation when the token is dropped or the session ends, not when a token is stored', () => {
    const start = getSessionGeneration();

    setAccessToken('abc');
    expect(getSessionGeneration()).toBe(start);

    setAccessToken(null);
    expect(getSessionGeneration()).toBe(start + 1);

    endSession();
    expect(getSessionGeneration()).toBe(start + 2);
  });

  it('tells every subscriber who a new session belongs to, until they unsubscribe', () => {
    const listener = vi.fn();
    const off = onSessionUser(listener);

    notifySessionUser(userRows[1]);
    off();
    notifySessionUser(userRows[0]);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(userRows[1]);
  });
});
