import { signInLive, type LiveSend } from '@/test/live-api';
import { unwrap } from '@/lib/core-api';
import { countriesSchema, countrySchema, syncResultSchema, type Country } from './schema';

// Opt-in: this talks to the real FastAPI service, so it is skipped unless you ask for it. The first block only reads
// countries, but every route needs a signed-in user, so it signs in with the admin that `make seed-admin` created, and
// signing in is not read-only: it writes that admin's `last_login_date` and a refresh-token row.
//   (in octacore-backend)  make run
//   (here)                 CORE_API_LIVE=1 CORE_API_TEST_EMAIL=<email> CORE_API_TEST_PASSWORD=<password> pnpm exec nx test core --skip-nx-cache
//
// The second block WRITES (countries, all deleted again; the deletes are soft, so rows stay in the table), so it only
// runs when CORE_API_WRITE_URL names a service on a scratch database, never one you care about. The sync test inside it
// also calls the open internet (the exchange-api) and changes the rates of the scratch database's active countries, so
// it needs CORE_API_SYNC=1 as well.
//   (in octacore-backend)  DB_NAME=<scratch db> .venv/bin/uvicorn app.main:create_app --factory --port 5002
//   (here)                 CORE_API_WRITE_URL=http://127.0.0.1:5002/api/v1 CORE_API_TEST_EMAIL=<email> CORE_API_TEST_PASSWORD=<password> pnpm exec nx test core --skip-nx-cache
//
// Written against docs/superpowers/specs/2026-10-19-countries-crud-design.md before the service existed: not yet run.
const live = Boolean(process.env.CORE_API_LIVE);
const base = process.env.CORE_API_URL ?? 'http://localhost:5001/api/v1';
const writeBase = process.env.CORE_API_WRITE_URL;
const syncToo = Boolean(process.env.CORE_API_SYNC);

let send: LiveSend;

const json = async (response: Response) => response.json();

describe.skipIf(!live)('the running core service', () => {
  beforeAll(async () => {
    send = await signInLive(base);
  });

  it('answers GET /countries in the shape the app expects, with currency, rate, tax rate and active flag', async () => {
    const response = await send('GET', '/countries');
    expect(response.status).toBe(200);
    const countries = unwrap(await response.json(), countriesSchema);
    expect(countries.length).toBeGreaterThan(200);
    expect(countries.find((country) => country.iso === 'GB')).toMatchObject({
      nicename: 'United Kingdom',
      iso3: 'GBR',
      phonecode: 44,
      currencyCode: 'GBP',
    });
    // US dollar countries always have rate 1, and a country the sync has not reached has none.
    for (const country of countries.filter((row) => row.currencyCode === 'USD')) expect(country.rate).toBe(1);
    expect(countries.some((country) => country.rate === null)).toBe(true);
  });

  it('answers an unknown country with an error envelope', async () => {
    const response = await send('GET', '/countries/99999');
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ statusCode: 404, data: null });
  });

  it('has been moved off /currencies', async () => {
    expect((await send('GET', '/currencies')).status).toBe(404);
  });
});

/** Two capitals no live country uses: a leftover from an earlier failed run cannot collide with it either. */
function freeIso(countries: Country[]): string {
  const taken = new Set(countries.map((country) => country.iso));
  for (const first of 'QXZJKWVY') {
    for (const second of 'QXZJKWVY') if (!taken.has(first + second)) return first + second;
  }
  throw new Error('No free ISO code left to test with');
}

const scratchBody = (iso: string, overrides: Record<string, unknown> = {}) => ({
  iso,
  nicename: `Live check ${iso}`,
  iso3: '',
  numcode: 0,
  phonecode: 0,
  currencyCode: 'XTS',
  currencyName: 'Live check currency',
  currencySymbol: '¤',
  rate: 88.25,
  taxRate: 12.5,
  active: true,
  ...overrides,
});

describe.skipIf(!writeBase)('the running core service, countries', () => {
  beforeAll(async () => {
    send = await signInLive(writeBase as string);
  });

  async function all(): Promise<Country[]> {
    return unwrap(await json(await send('GET', '/countries')), countriesSchema);
  }

  it('adds, edits and deletes a country, with the capitals applied and the rate cleared by a currency change', async () => {
    const iso = freeIso(await all());
    const created = await send('POST', '/countries', scratchBody(iso.toLowerCase(), { currencyCode: 'xts' }));
    expect(created.status).toBe(201);
    const row = unwrap(await json(created), countrySchema);
    try {
      expect(row).toMatchObject({ iso, currencyCode: 'XTS', rate: 88.25, taxRate: 12.5, active: true, iso3: '' });

      // A second live country with the same ISO code is refused.
      expect((await send('POST', '/countries', scratchBody(iso))).status).toBe(409);

      // Changing the currency without sending a rate clears it; sending `rate: null` clears it too.
      const changed = await send('PATCH', `/countries/${row.id}`, { currencyCode: 'XTT' });
      expect(changed.status).toBe(200);
      expect(unwrap(await json(changed), countrySchema)).toMatchObject({ currencyCode: 'XTT', rate: null });
      const typed = await send('PATCH', `/countries/${row.id}`, { rate: 3.5, taxRate: 0 });
      expect(unwrap(await json(typed), countrySchema)).toMatchObject({ rate: 3.5, taxRate: 0 });
      const cleared = await send('PATCH', `/countries/${row.id}`, { rate: null });
      expect(unwrap(await json(cleared), countrySchema).rate).toBeNull();

      // A US dollar country always has rate 1: the service forces it, and refuses another.
      const dollars = await send('PATCH', `/countries/${row.id}`, { currencyCode: 'USD' });
      expect(unwrap(await json(dollars), countrySchema)).toMatchObject({ currencyCode: 'USD', rate: 1 });
      expect((await send('PATCH', `/countries/${row.id}`, { rate: 2 })).status).toBe(422);
    } finally {
      expect((await send('DELETE', `/countries/${row.id}`)).status).toBe(200);
    }
    // Once deleted, its ISO code can be used again.
    const again = await send('POST', '/countries', scratchBody(iso));
    expect(again.status).toBe(201);
    expect((await send('DELETE', `/countries/${unwrap(await json(again), countrySchema).id}`)).status).toBe(200);
  });

  it('refuses a body the schema does not allow, never with a 500', async () => {
    const iso = freeIso(await all());
    for (const bad of [
      scratchBody(iso, { iso: 'ABC' }),
      scratchBody(iso, { currencyCode: 'EU' }),
      scratchBody(iso, { currencySymbol: '€€€€€' }),
      scratchBody(iso, { rate: 0 }),
      scratchBody(iso, { rate: 1_000_001 }),
      scratchBody(iso, { taxRate: 100.5 }),
      scratchBody(iso, { numcode: 1000 }),
    ]) {
      expect((await send('POST', '/countries', bad)).status).toBe(422);
    }
  });

  it('keeps at least one active country that uses US dollars', async () => {
    const dollars = (await all()).filter((country) => country.active && country.currencyCode === 'USD');
    // The seed switches on the United States only; on a database with more, this check does not apply.
    expect(dollars.map((country) => country.iso)).toEqual(['US']);
    const us = dollars[0];
    expect((await send('PATCH', `/countries/${us.id}`, { active: false })).status).toBe(409);
    expect((await send('PATCH', `/countries/${us.id}`, { currencyCode: 'EUR' })).status).toBe(409);
    expect((await send('DELETE', `/countries/${us.id}`)).status).toBe(409);
  });

  it.skipIf(!syncToo)('syncs the rates of the active countries from the exchange-api', async () => {
    const response = await send('POST', '/countries/sync-rates');
    // 502 when the exchange-api cannot be reached from where the service runs.
    if (response.status === 502) {
      expect(await response.json()).toMatchObject({ statusCode: 502, data: null });
      return;
    }
    expect(response.status).toBe(200);
    const result = unwrap(await json(response), syncResultSchema);
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // US dollars are skipped, and nothing was switched on or off.
    expect(result.updatedCurrencies).not.toContain('USD');
    const countries = await all();
    expect(countries.filter((country) => country.active && country.currencyCode === 'USD').map((row) => row.rate)).toEqual([1]);
  });
});
