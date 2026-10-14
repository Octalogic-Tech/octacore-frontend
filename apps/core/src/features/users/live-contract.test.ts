import { authSessionSchema, userRowSchema } from '@/lib/auth-schema';
import { unwrap } from '@/lib/core-api';
import { userRowsSchema } from './schema';

// Opt-in: this talks to the real FastAPI service and WRITES to it (it adds a user, edits it, signs it in, deletes it
// and walks the refresh and logout cookie; deletes are soft, so a row stays in the table). It only runs when
// CORE_API_WRITE_URL names a service on a scratch database, never one you care about, and it signs in with the admin
// that `make seed-admin` created there.
//   (in octacore-backend)  ADMIN_EMAIL=<email> ADMIN_PASSWORD=<password> ADMIN_NAME=<name> make seed-admin
//   (here)                 CORE_API_WRITE_URL=http://127.0.0.1:5003/api/v1 CORE_API_TEST_EMAIL=<email> CORE_API_TEST_PASSWORD=<password> pnpm exec nx test core --skip-nx-cache
const base = process.env.CORE_API_WRITE_URL;
const email = process.env.CORE_API_TEST_EMAIL;
const password = process.env.CORE_API_TEST_PASSWORD;

const call = (method: string, path: string, options: { body?: unknown; token?: string; cookie?: string } = {}) =>
  fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

/** `name=value` of the refresh cookie a response sets. */
const cookieOf = (response: Response) => (response.headers.get('set-cookie') ?? '').split(';')[0];

describe.skipIf(!base)('the running core service, sign-in and users', () => {
  it('signs in, manages a user, and ends sessions the way the app expects', async () => {
    if (!email || !password) throw new Error('Set CORE_API_TEST_EMAIL and CORE_API_TEST_PASSWORD.');
    const stamp = Date.now();
    const newEmail = `live-${stamp}@example.com`;
    const newPassword = `live passphrase ${stamp}`;

    // Nothing is open without a token.
    expect((await call('GET', '/users')).status).toBe(401);

    // Sign in: the access token comes in the body, the refresh token only as an httpOnly cookie.
    const login = await call('POST', '/auth/login', { body: { email, password } });
    expect(login.status).toBe(200);
    expect(login.headers.get('set-cookie')).toContain('HttpOnly');
    expect(login.headers.get('set-cookie')).toContain('Path=/api/v1/auth');
    const session = unwrap(await login.json(), authSessionSchema);
    expect(session.user.email).toBe(email.trim().toLowerCase());
    const refreshCookie = cookieOf(login);
    expect(refreshCookie).toMatch(/^octacore_refresh=/);

    // A wrong password is the same 401 as an unknown account.
    const wrong = await call('POST', '/auth/login', { body: { email, password: 'not the password' } });
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toMatchObject({ message: 'Invalid email or password' });

    // Add a user, read it back, change it.
    const created = await call('POST', '/users', {
      token: session.accessToken,
      body: { name: 'Live Check', email: newEmail, role: 'admin', password: newPassword },
    });
    expect(created.status).toBe(201);
    const createdText = await created.text();
    // The raw body, not the parsed row: parsing drops keys it does not know, which would hide a leaked hash.
    expect(createdText).not.toMatch(/password/i);
    const row = unwrap(JSON.parse(createdText), userRowSchema);
    try {
      const listed = unwrap(await (await call('GET', '/users', { token: session.accessToken })).json(), userRowsSchema);
      expect(listed.map((user) => user.id)).toContain(row.id);

      const duplicate = await call('POST', '/users', {
        token: session.accessToken,
        body: { name: 'Dup', email: newEmail.toUpperCase(), role: 'admin', password: newPassword },
      });
      expect(duplicate.status).toBe(409);

      const patched = await call('PATCH', `/users/${row.id}`, {
        token: session.accessToken,
        body: { name: 'Live Checked' },
      });
      expect(patched.status).toBe(200);
      expect(unwrap(await patched.json(), userRowSchema).name).toBe('Live Checked');

      // The new user can sign in, and is locked out the moment they are deleted.
      const newLogin = await call('POST', '/auth/login', { body: { email: newEmail, password: newPassword } });
      expect(newLogin.status).toBe(200);
      const newToken = unwrap(await newLogin.json(), authSessionSchema).accessToken;
      expect((await call('GET', '/categories', { token: newToken })).status).toBe(200);
      expect((await call('DELETE', `/users/${row.id}`, { token: session.accessToken })).status).toBe(200);
      expect((await call('GET', '/categories', { token: newToken })).status).toBe(401);
      expect((await call('POST', '/auth/login', { body: { email: newEmail, password: newPassword } })).status).toBe(401);

      // You cannot delete yourself.
      const self = await call('DELETE', `/users/${session.user.id}`, { token: session.accessToken });
      expect(self.status).toBe(409);
    } finally {
      await call('DELETE', `/users/${row.id}`, { token: session.accessToken });
    }

    // Refresh rotates the cookie; logout revokes it, and a logged-out token is refused straight away.
    const refreshed = await call('POST', '/auth/refresh', { cookie: refreshCookie });
    expect(refreshed.status).toBe(200);
    unwrap(await refreshed.json(), authSessionSchema);
    const rotatedCookie = cookieOf(refreshed);
    expect(rotatedCookie).not.toBe(refreshCookie);
    expect((await call('POST', '/auth/logout', { cookie: rotatedCookie })).status).toBe(200);
    expect((await call('POST', '/auth/refresh', { cookie: rotatedCookie })).status).toBe(401);
  });
});
