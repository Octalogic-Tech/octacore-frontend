import { endSession, getAccessToken, onSessionEnded, setAccessToken } from './session';

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
});
