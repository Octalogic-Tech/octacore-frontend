import { countriesSchema, countrySchema } from '@/features/countries/schema';
import { expenseTypeRowSchema } from '@/features/expense-types/schema';
import { personRowSchema } from '@/features/people/schema';
import { unwrap } from '@/lib/core-api';
import { signInLive, type LiveSend } from '@/test/live-api';
import { expenseRowSchema, expenseRowsSchema, expenseSummarySchema, recurringRowSchema, recurringRowsSchema } from './schema';

// Opt-in: this talks to the real FastAPI service and WRITES to it (a type, a country, expenses and a recurring
// expense, all deleted again; the deletes are soft, so rows stay in the tables). It only runs when
// CORE_API_WRITE_URL names a service on a scratch database, never one you care about.
//   (in octacore-backend)  DB_NAME=<scratch db> .venv/bin/uvicorn app.main:create_app --factory --port 5002
//   (here)                 CORE_API_WRITE_URL=http://127.0.0.1:5002/api/v1 CORE_API_TEST_EMAIL=<email> CORE_API_TEST_PASSWORD=<password> pnpm exec nx test core --skip-nx-cache
// Written against docs/superpowers/specs/2026-10-19-countries-crud-design.md before the service existed: not yet run.
const base = process.env.CORE_API_WRITE_URL;

let send: LiveSend;

const json = async (response: Response) => response.json();

/** Three random capital letters: a currency code a leftover from an earlier failed run cannot collide with. */
const randomCode = () => Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');

async function countries() {
  return unwrap(await json(await send('GET', '/countries')), countriesSchema);
}

async function usdCountryId(): Promise<number> {
  const usd = (await countries()).find((row) => row.currencyCode === 'USD' && row.active);
  if (!usd) throw new Error('The service has no active country that uses US dollars: has the migration run and the seed?');
  return usd.id;
}

/** A country of its own to type a charge under, with a rate, so a test never edits a seeded country. */
async function createCountry(rate: number) {
  const taken = new Set((await countries()).map((row) => row.iso));
  const iso = ['QX', 'QZ', 'QJ', 'QK', 'QW', 'QV', 'QY'].find((candidate) => !taken.has(candidate));
  if (!iso) throw new Error('No free ISO code left to test with');
  const code = randomCode();
  const created = await send('POST', '/countries', {
    iso,
    nicename: `Live check ${iso}`,
    iso3: '',
    numcode: 0,
    phonecode: 0,
    currencyCode: code,
    currencyName: 'Live check currency',
    currencySymbol: '¤',
    rate,
    taxRate: 0,
    active: true,
  });
  expect(created.status).toBe(201);
  return { country: unwrap(await json(created), countrySchema), code };
}

describe.skipIf(!base)('the running core service, expenses', () => {
  beforeAll(async () => {
    send = await signInLive(base as string);
  });

  it('keeps the dollar country’s rate at 1, and its place as the last active one', async () => {
    const id = await usdCountryId();
    const row = unwrap(await json(await send('GET', `/countries/${id}`)), countrySchema);
    expect(row).toMatchObject({ currencyCode: 'USD', currencySymbol: '$', rate: 1, active: true });
    expect((await send('PATCH', `/countries/${id}`, { rate: 2 })).status).toBe(422);
    expect((await send('DELETE', `/countries/${id}`)).status).toBe(409);
  });

  it('converts a rupee expense, keeps its rate, and leaves it alone when the rate changes', async () => {
    const type = unwrap(
      await json(await send('POST', '/expense-types', { name: `Live check ${randomCode()}`, description: null })),
      expenseTypeRowSchema,
    );
    const { country, code } = await createCountry(88.25);
    const person = unwrap(
      await json(await send('POST', '/people', { name: `Live check person ${randomCode()}` })),
      personRowSchema,
    );
    let expenseId: number | undefined;
    try {
      const created = await send('POST', '/expenses', {
        name: 'Live check desk',
        notes: null,
        expenseTypeId: type.id,
        projectId: null,
        personId: person.id,
        chargeDate: '2026-10-01',
        countryId: country.id,
        amount: 882500,
      });
      expect(created.status).toBe(201);
      const row = unwrap(await json(created), expenseRowSchema);
      expenseId = row.id;
      expect(row).toMatchObject({ amountCents: 10000, originalAmount: 882500, exchangeRate: 88.25 });
      expect(row.originalCountry).toEqual({
        id: country.id,
        name: country.nicename,
        currencyCode: code,
        currencySymbol: '¤',
      });
      expect(row.person).toEqual({ id: person.id, name: person.name });

      // Filtered by the person, the expense is found; for a person nobody has, it is not.
      const byPerson = unwrap(await json(await send('GET', `/expenses?personId=${person.id}`)), expenseRowsSchema);
      expect(byPerson.map((expense) => expense.id)).toEqual([row.id]);

      const listed = unwrap(
        await json(await send('GET', '/expenses?from=2026-10-01&to=2026-10-01&q=Live%20check%20desk')),
        expenseRowsSchema,
      );
      expect(listed.map((expense) => expense.id)).toContain(row.id);
      const summary = unwrap(
        await json(await send('GET', '/expenses/summary?from=2026-10-01&to=2026-10-01&q=Live%20check%20desk')),
        expenseSummarySchema,
      );
      expect(summary).toMatchObject({ totalCents: 10000, count: 1 });
      expect(summary.byMonth).toEqual([{ month: '2026-10', totalCents: 10000 }]);

      expect((await send('PATCH', `/countries/${country.id}`, { rate: 90 })).status).toBe(200);
      const edited = await send('PATCH', `/expenses/${row.id}`, { notes: 'Edited' });
      expect(edited.status).toBe(200);
      expect(unwrap(await json(edited), expenseRowSchema)).toMatchObject({
        notes: 'Edited',
        amountCents: 10000,
        exchangeRate: 88.25,
      });
      // The service refuses a half-sent amount, and one that comes to under a cent.
      expect((await send('PATCH', `/expenses/${row.id}`, { amount: 100 })).status).toBe(422);
      expect(
        (
          await send('POST', '/expenses', {
            name: 'Too small',
            notes: null,
            expenseTypeId: type.id,
            projectId: null,
            chargeDate: '2026-10-01',
            countryId: country.id,
            amount: 1,
          })
        ).status,
      ).toBe(422);
      // A country an expense uses cannot be deleted.
      expect((await send('DELETE', `/countries/${country.id}`)).status).toBe(409);
    } finally {
      if (expenseId !== undefined) expect((await send('DELETE', `/expenses/${expenseId}`)).status).toBe(200);
      expect((await send('DELETE', `/people/${person.id}`)).status).toBe(200);
      expect((await send('DELETE', `/countries/${country.id}`)).status).toBe(200);
      expect((await send('DELETE', `/expense-types/${type.id}`)).status).toBe(200);
    }
  });

  it('creates a recurring expense’s charges at once, pauses it and resumes it', async () => {
    const name = `Live check yearly ${randomCode()}`;
    const type = unwrap(
      await json(await send('POST', '/expense-types', { name: `Live check ${randomCode()}`, description: null })),
      expenseTypeRowSchema,
    );
    let recurringId: number | undefined;
    try {
      const created = await send('POST', '/recurring-expenses', {
        name,
        notes: null,
        expenseTypeId: type.id,
        projectId: null,
        countryId: await usdCountryId(),
        amount: 1500,
        frequency: 'yearly',
        startDate: '2022-03-01',
        endDate: null,
      });
      expect(created.status).toBe(201);
      const body = await json(created);
      const row = unwrap(body, recurringRowSchema);
      recurringId = row.id;
      expect(row).toMatchObject({ state: 'active', amountCents: 1500, monthlyCostCents: 125, yearlyCostCents: 1500 });
      // Every March 1 from 2022 up to today: four or more, whatever today is.
      expect(body.data.generatedCount).toBeGreaterThanOrEqual(4);

      const charges = unwrap(
        await json(await send('GET', `/expenses?recurring=true&q=${encodeURIComponent(name)}`)),
        expenseRowsSchema,
      );
      expect(charges.length).toBe(body.data.generatedCount);
      expect(charges.every((charge) => charge.recurringExpenseId === row.id)).toBe(true);

      const paused = await send('PATCH', `/recurring-expenses/${row.id}`, { state: 'paused' });
      expect(unwrap(await json(paused), recurringRowSchema).state).toBe('paused');
      const resumed = await send('PATCH', `/recurring-expenses/${row.id}`, { state: 'active' });
      const after = unwrap(await json(resumed), recurringRowSchema);
      expect(after.state).toBe('active');
      expect(after.nextChargeDate).not.toBeNull();

      const all = unwrap(await json(await send('GET', '/recurring-expenses')), recurringRowsSchema);
      expect(all.map((expense) => expense.id)).toContain(row.id);

      for (const charge of charges) expect((await send('DELETE', `/expenses/${charge.id}`)).status).toBe(200);
    } finally {
      if (recurringId !== undefined) expect((await send('DELETE', `/recurring-expenses/${recurringId}`)).status).toBe(200);
      expect((await send('DELETE', `/expense-types/${type.id}`)).status).toBe(200);
    }
  });

  it('answers a bad body with an error envelope, never a 500', async () => {
    const response = await send('POST', '/expenses', { name: '' });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ statusCode: 422 });
    expect((await send('GET', '/expenses?from=2026-02-30')).status).toBe(422);
    expect((await send('DELETE', '/expenses/99999')).status).toBe(404);
  });
});
