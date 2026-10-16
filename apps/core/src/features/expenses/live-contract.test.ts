import { currencyRowSchema, currencyRowsSchema } from '@/features/currencies/schema';
import { expenseTypeRowSchema } from '@/features/expense-types/schema';
import { unwrap } from '@/lib/core-api';
import { signInLive, type LiveSend } from '@/test/live-api';
import { expenseRowSchema, expenseRowsSchema, expenseSummarySchema, recurringRowSchema, recurringRowsSchema } from './schema';

// Opt-in: this talks to the real FastAPI service and WRITES to it (a type, a currency, expenses and a recurring
// expense, all deleted again; the deletes are soft, so rows stay in the tables). It only runs when
// CORE_API_WRITE_URL names a service on a scratch database, never one you care about.
//   (in octacore-backend)  DB_NAME=<scratch db> .venv/bin/uvicorn app.main:create_app --factory --port 5002
//   (here)                 CORE_API_WRITE_URL=http://127.0.0.1:5002/api/v1 CORE_API_TEST_EMAIL=<email> CORE_API_TEST_PASSWORD=<password> pnpm exec nx test core --skip-nx-cache
const base = process.env.CORE_API_WRITE_URL;

let send: LiveSend;

const json = async (response: Response) => response.json();

/** Three random capital letters: a code a leftover from an earlier failed run cannot collide with. */
const randomCode = () => Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');

async function usdId(): Promise<number> {
  const rows = unwrap(await json(await send('GET', '/currencies')), currencyRowsSchema);
  const usd = rows.find((row) => row.code === 'USD');
  if (!usd) throw new Error('The service has no US dollar currency: has the migration run?');
  return usd.id;
}

describe.skipIf(!base)('the running core service, expenses', () => {
  beforeAll(async () => {
    send = await signInLive(base as string);
  });

  it('keeps US dollars as the primary currency, locked', async () => {
    const id = await usdId();
    const row = unwrap(await json(await send('GET', `/currencies/${id}`)), currencyRowSchema);
    expect(row).toMatchObject({ code: 'USD', symbol: '$', rate: 1 });
    expect((await send('PATCH', `/currencies/${id}`, { rate: 2 })).status).toBe(409);
    expect((await send('DELETE', `/currencies/${id}`)).status).toBe(409);
  });

  it('converts a rupee expense, keeps its rate, and leaves it alone when the rate changes', async () => {
    const type = unwrap(
      await json(await send('POST', '/expense-types', { name: `Live check ${randomCode()}`, description: null })),
      expenseTypeRowSchema,
    );
    const code = randomCode();
    const currency = unwrap(
      await json(await send('POST', '/currencies', { code, name: 'Live check currency', symbol: '¤', rate: 88.25 })),
      currencyRowSchema,
    );
    let expenseId: number | undefined;
    try {
      const created = await send('POST', '/expenses', {
        name: 'Live check desk',
        notes: null,
        expenseTypeId: type.id,
        projectId: null,
        chargeDate: '2026-10-01',
        currencyId: currency.id,
        amount: 882500,
      });
      expect(created.status).toBe(201);
      const row = unwrap(await json(created), expenseRowSchema);
      expenseId = row.id;
      expect(row).toMatchObject({ amountCents: 10000, originalAmount: 882500, exchangeRate: 88.25 });
      expect(row.originalCurrency).toMatchObject({ id: currency.id, code });

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

      expect((await send('PATCH', `/currencies/${currency.id}`, { rate: 90 })).status).toBe(200);
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
            currencyId: currency.id,
            amount: 1,
          })
        ).status,
      ).toBe(422);
    } finally {
      if (expenseId !== undefined) expect((await send('DELETE', `/expenses/${expenseId}`)).status).toBe(200);
      expect((await send('DELETE', `/currencies/${currency.id}`)).status).toBe(200);
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
        currencyId: await usdId(),
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
