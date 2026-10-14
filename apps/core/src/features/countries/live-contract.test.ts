import { signInLive, type LiveSend } from '@/test/live-api';
import { unwrap } from '@/lib/core-api';
import { countriesSchema } from './schema';

// Opt-in: this talks to the real FastAPI service, so it is skipped unless you ask for it. It only reads, but every
// route needs a signed-in user, so it signs in with the admin that `make seed-admin` created.
//   (in octacore-backend)  make run
//   (here)                 CORE_API_LIVE=1 CORE_API_TEST_EMAIL=<email> CORE_API_TEST_PASSWORD=<password> pnpm exec nx test core --skip-nx-cache
const live = Boolean(process.env.CORE_API_LIVE);
const base = process.env.CORE_API_URL ?? 'http://localhost:5001/api/v1';

let send: LiveSend;

describe.skipIf(!live)('the running core service', () => {
  beforeAll(async () => {
    send = await signInLive(base);
  });

  it('answers GET /countries in the shape the app expects', async () => {
    const response = await send('GET', '/countries');
    expect(response.status).toBe(200);
    const countries = unwrap(await response.json(), countriesSchema);
    expect(countries.length).toBeGreaterThan(200);
    expect(countries.find((country) => country.iso === 'GB')).toMatchObject({
      nicename: 'United Kingdom',
      iso3: 'GBR',
      phonecode: 44,
    });
  });

  it('answers an unknown country with an error envelope', async () => {
    const response = await send('GET', '/countries/99999');
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ statusCode: 404, data: null });
  });
});
