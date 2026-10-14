export type LiveSend = (method: string, path: string, body?: unknown) => Promise<Response>;

/**
 * Signs in to a real core service with the admin that `make seed-admin` created on the scratch database
 * (CORE_API_TEST_EMAIL and CORE_API_TEST_PASSWORD), and returns a `fetch` wrapper that sends the access token.
 */
export async function signInLive(base: string): Promise<LiveSend> {
  const email = process.env.CORE_API_TEST_EMAIL;
  const password = process.env.CORE_API_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Set CORE_API_TEST_EMAIL and CORE_API_TEST_PASSWORD to the admin created with `make seed-admin` on the scratch database.',
    );
  }
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!login.ok) throw new Error(`Signing in to ${base} failed with status ${login.status}`);
  const accessToken = (await login.json()).data.accessToken as string;
  return (method, path, body) =>
    fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
}
