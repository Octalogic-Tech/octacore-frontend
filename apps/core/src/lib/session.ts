import type { UserRow } from '@/lib/auth-schema';

/**
 * The access token lives here, in memory only. It is never written to localStorage or sessionStorage, so a script
 * injected into the page cannot read a stored credential, and a reload starts signed out until the refresh cookie
 * (which JavaScript cannot read either) restores the session.
 */
let accessToken: string | null = null;
/**
 * Bumped whenever the session is dropped (sign-out, session ended). A refresh that started under an older
 * generation finished for a session that no longer exists, so its token must not be kept.
 */
let generation = 0;
const endedListeners = new Set<() => void>();
const userListeners = new Set<(user: UserRow) => void>();

export const getAccessToken = () => accessToken;

export const getSessionGeneration = () => generation;

export const setAccessToken = (token: string | null) => {
  if (token === null) generation += 1;
  accessToken = token;
};

/**
 * Called when the service has refused the refresh cookie mid-use (it expired, was revoked, or its user is gone), or
 * another tab signed out. A refresh that merely could not reach the service does not end the session: the next
 * request tries again. Returns an unsubscribe function.
 */
export function onSessionEnded(listener: () => void): () => void {
  endedListeners.add(listener);
  return () => {
    endedListeners.delete(listener);
  };
}

export function endSession() {
  generation += 1;
  accessToken = null;
  endedListeners.forEach((listener) => listener());
}

/**
 * Called with the user every new session (sign-in, refresh, password change) belongs to. A refresh can come back as
 * someone else (another person signed in in another tab, which replaced the shared cookie) or with changed details,
 * and whoever shows the signed-in user needs to know. Returns an unsubscribe function.
 */
export function onSessionUser(listener: (user: UserRow) => void): () => void {
  userListeners.add(listener);
  return () => {
    userListeners.delete(listener);
  };
}

export function notifySessionUser(user: UserRow) {
  userListeners.forEach((listener) => listener(user));
}
