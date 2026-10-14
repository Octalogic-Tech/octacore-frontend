/**
 * The access token lives here, in memory only. It is never written to localStorage or sessionStorage, so a script
 * injected into the page cannot read a stored credential, and a reload starts signed out until the refresh cookie
 * (which JavaScript cannot read either) restores the session.
 */
let accessToken: string | null = null;
const endedListeners = new Set<() => void>();

export const getAccessToken = () => accessToken;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

/** Called when the session cannot be recovered (a refresh failed mid-use). Returns an unsubscribe function. */
export function onSessionEnded(listener: () => void): () => void {
  endedListeners.add(listener);
  return () => {
    endedListeners.delete(listener);
  };
}

export function endSession() {
  accessToken = null;
  endedListeners.forEach((listener) => listener());
}
