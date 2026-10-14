/**
 * A sign-out that could not reach the service leaves the httpOnly refresh cookie alive, and JavaScript cannot clear
 * it. This flag (not a credential: it only says "a logout is owed") makes the next load call /auth/logout instead of
 * restoring the session from that cookie. localStorage can throw (a private window, storage turned off), so every
 * access is guarded; without storage the flag is simply lost.
 */
const KEY = 'octacore.pendingLogout';

export function hasPendingLogout(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markPendingLogout() {
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    // Nothing more can be done here; the cookie still expires on its own.
  }
}

export function clearPendingLogout() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // As above.
  }
}
