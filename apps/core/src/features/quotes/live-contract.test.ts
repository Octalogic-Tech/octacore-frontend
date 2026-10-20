import { z } from 'zod';
import { unwrap } from '@/lib/core-api';
import { signInLive, type LiveSend } from '@/test/live-api';
import { quoteTotals, type CalcSettings, type QuoteTotals } from './calc';
import {
  emptyQuoteForm,
  quoteFormSchema,
  quoteRowSchema,
  quoteRowsSchema,
  toCalcInput,
  toQuoteBody,
  toQuoteFormValues,
  type QuoteFormValues,
  type QuoteRow,
} from './schema';

// Opt-in: this talks to the real FastAPI service and WRITES to it (it adds quotations, changes them and deletes them; the
// deletes are soft, so rows stay in the tables). It only runs when CORE_API_WRITE_URL names a service on a scratch
// database, never one you care about.
//   (in octacore-backend)  DB_NAME=<scratch> .venv/bin/uvicorn app.main:create_app --factory --port 5002
//   (here, in apps/core)   CORE_API_WRITE_URL=http://127.0.0.1:5002/api/v1 CORE_API_TEST_EMAIL=<email> CORE_API_TEST_PASSWORD=<password> pnpm exec vitest run src/features/quotes/live-contract.test.ts
const base = process.env.CORE_API_WRITE_URL;

let send: LiveSend;

const createdSchema = z.object({ id: z.number().int() });

const readQuote = async (id: number) => unwrap(await (await send('GET', `/quotations/${id}`)).json(), quoteRowSchema);
const listedQuotes = async () => unwrap(await (await send('GET', '/quotations')).json(), quoteRowsSchema);

/** A form with the defaults and the given title, settings and lines (units and hours per unit as typed). */
function quoteForm(
  title: string,
  lines: [units: string, hours: string][],
  settings: Partial<QuoteFormValues> = {},
): QuoteFormValues {
  return {
    ...emptyQuoteForm,
    ...settings,
    title,
    lines: lines.map(([units, hoursPerUnit], index) => ({
      title: `Line ${index + 1}`,
      description: `What line ${index + 1} covers`,
      units,
      hoursPerUnit,
    })),
  };
}

// The workbook's 53 lines of one unit each: the hours per line and how many lines have them (1,188 hours in all).
const WORKBOOK_HOURS_BY_COUNT: Record<number, number> = { 16: 24, 24: 14, 32: 4, 8: 3, 20: 3, 48: 3, 56: 2 };

const workbookForm = (): QuoteFormValues =>
  quoteForm(
    'Workbook check',
    Object.entries(WORKBOOK_HOURS_BY_COUNT).flatMap(([hours, count]) =>
      Array.from({ length: count }, (): [string, string] => ['1', hours]),
    ),
  );

// The second vector: every step lands on a half or near it, and every setting is off its default.
const secondForm = (): QuoteFormValues =>
  quoteForm(
    'Second vector check',
    [
      ['2', '7.5'],
      ['3', '0.25'],
      ['1', '12.34'],
    ],
    {
      developerCount: '2',
      developerRate: '1234.56',
      managerCount: '1',
      managerRate: '2000.00',
      testerCount: '2',
      testerRate: '999.99',
      negotiationBufferPercent: '7.5',
      managementPercent: '12.5',
      testingPercent: '10',
      bugFixPercent: '5',
      hoursPerDay: '7',
      hoursPerMonth: '150',
    },
  );

/** Creates a quote from a form the form's own schema accepts, through `toQuoteBody`, and reads the answer. */
async function createFrom(form: QuoteFormValues): Promise<QuoteRow> {
  expect(quoteFormSchema.safeParse(form).success).toBe(true);
  const created = await send('POST', '/quotations', toQuoteBody(form));
  expect(created.status).toBe(201);
  return unwrap(await created.json(), quoteRowSchema);
}

/**
 * The service's totals equal the mirror's, field by field. The service sends hours, person-days and months as decimal
 * numbers (1188, 2.48) and the mirror holds them in hundredths; every cost is whole cents on both sides.
 */
function expectTotalsToMatch(row: QuoteRow, form: QuoteFormValues) {
  const { settings, lines } = toCalcInput(form);
  expect(settings).not.toBeNull();
  const mine = quoteTotals(settings as CalcSettings, lines);
  const fields = Object.keys(mine) as (keyof QuoteTotals)[];
  expect(fields).toHaveLength(18);
  expect(Object.keys(row.totals).sort()).toEqual([...fields].sort());
  for (const field of fields) {
    const theirs = field.endsWith('Cents') ? row.totals[field] : Math.round(row.totals[field] * 100);
    expect(mine[field], field).toBe(theirs);
  }
}

describe.skipIf(!base)('the running core service, quotations', () => {
  beforeAll(async () => {
    send = await signInLive(base as string);
  });

  it('the workbook vector: the service and the mirror agree, through a create, an edit and a delete', async () => {
    const form = workbookForm();
    expect(form.lines).toHaveLength(53);
    const quote = await createFrom(form);
    try {
      expect(quote).toMatchObject({ title: 'Workbook check', currencyCode: 'INR', developerCount: 3, developerRateCents: 310_000 });
      expect(quote.lines).toHaveLength(53);
      expect(quote.totals.finalQuoteCents).toBe(571_725_000);
      expectTotalsToMatch(quote, form);

      // The row reads back into the same form, so a save without a change sends what was stored.
      expect(toQuoteBody(toQuoteFormValues(quote))).toEqual(toQuoteBody(form));

      const listed = await listedQuotes();
      expect(listed.find((row) => row.id === quote.id)).toMatchObject({ title: 'Workbook check' });

      // Edit: the lines are replaced as a set and one setting changes (a developer costs 3,200.00 an hour now).
      const edited = quoteForm(
        'Workbook check, edited',
        [
          ['1', '16'],
          ['5', '2.5'],
          ['1', '0.01'],
        ],
        { developerRate: '3200.00' },
      );
      expect(quoteFormSchema.safeParse(edited).success).toBe(true);
      const patched = await send('PATCH', `/quotations/${quote.id}`, toQuoteBody(edited));
      expect(patched.status).toBe(200);
      const patchedQuote = unwrap(await patched.json(), quoteRowSchema);
      expect(patchedQuote.lines.map((line) => [line.title, line.description, line.units, line.hoursPerUnit])).toEqual([
        ['Line 1', 'What line 1 covers', 1, 16],
        ['Line 2', 'What line 2 covers', 5, 2.5],
        ['Line 3', 'What line 3 covers', 1, 0.01],
      ]);
      expect(patchedQuote).toMatchObject({ title: 'Workbook check, edited', developerRateCents: 320_000 });
      expectTotalsToMatch(patchedQuote, edited);
      // A fresh read, not only the answer to the PATCH.
      const reread = await readQuote(quote.id);
      expect(reread.totals).toEqual(patchedQuote.totals);
      expectTotalsToMatch(reread, edited);

      // One setting alone leaves the lines as they are.
      const settingOnly = await send('PATCH', `/quotations/${quote.id}`, { managementPercent: 30 });
      expect(settingOnly.status).toBe(200);
      const settingForm = { ...edited, managementPercent: '30' };
      const afterSetting = await readQuote(quote.id);
      expect(afterSetting.lines).toHaveLength(3);
      expectTotalsToMatch(afterSetting, settingForm);
    } finally {
      const deleted = await send('DELETE', `/quotations/${quote.id}`);
      expect(deleted.status).toBe(200);
    }

    expect((await send('GET', `/quotations/${quote.id}`)).status).toBe(404);
    expect((await listedQuotes()).some((row) => row.id === quote.id)).toBe(false);
  });

  it('the second vector: halves and near-halves come out the same on both sides', async () => {
    const form = secondForm();
    const quote = await createFrom(form);
    try {
      expect(quote).toMatchObject({
        developerRateCents: 123_456,
        managerRateCents: 200_000,
        testerRateCents: 99_999,
        negotiationBufferPercent: 7.5,
        managementPercent: 12.5,
        testingPercent: 10,
        bugFixPercent: 5,
        hoursPerDay: 7,
        hoursPerMonth: 150,
      });
      expect(quote.totals.finalQuoteCents).toBe(5_084_443);
      expectTotalsToMatch(quote, form);
      expect(toQuoteBody(toQuoteFormValues(quote))).toEqual(toQuoteBody(form));

      // Edit: one line of 1.49 hours and no testing or bug fixing, so the build is 1.49 hours. Two developers at 150 hours
      // a month: one division gives 149 / 300, which is 0 months; dividing the hours by the developers first would give 1.
      const edited = {
        ...form,
        testingPercent: '0',
        bugFixPercent: '0',
        lines: [{ title: 'Only line', description: 'The one thing left to build', units: '1', hoursPerUnit: '1.49' }],
      };
      expect(quoteFormSchema.safeParse(edited).success).toBe(true);
      const patched = await send('PATCH', `/quotations/${quote.id}`, toQuoteBody(edited));
      expect(patched.status).toBe(200);
      const patchedQuote = unwrap(await patched.json(), quoteRowSchema);
      expect(patchedQuote.totals).toMatchObject({ buildHours: 1.49, elapsedMonths: 0 });
      expectTotalsToMatch(patchedQuote, edited);
      expectTotalsToMatch(await readQuote(quote.id), edited);
    } finally {
      await send('DELETE', `/quotations/${quote.id}`);
    }
    expect((await send('GET', `/quotations/${quote.id}`)).status).toBe(404);
  });

  it('a body whose final quote is above the cap is a 422, from a create and from an edit', async () => {
    // 200 lines of 100,000 units at 10,000 hours: each field is in range, the quote is not. The form refuses it too.
    const huge = quoteForm(
      'Too large',
      Array.from({ length: 200 }, (): [string, string] => ['100000', '10000']),
    );
    expect(quoteFormSchema.safeParse(huge).success).toBe(false);
    const before = (await listedQuotes()).length;
    const refused = await send('POST', '/quotations', toQuoteBody(huge));
    expect(refused.status).toBe(422);
    expect(await refused.json()).toMatchObject({ statusCode: 422 });
    expect((await listedQuotes()).length).toBe(before);

    const quote = await createFrom(quoteForm('Small then large', [['1', '8']]));
    try {
      const refusedEdit = await send('PATCH', `/quotations/${quote.id}`, { lines: toQuoteBody(huge).lines });
      expect(refusedEdit.status).toBe(422);
      // The quote is as it was.
      expect((await readQuote(quote.id)).lines).toHaveLength(1);
    } finally {
      await send('DELETE', `/quotations/${quote.id}`);
    }
  });

  it('answers 404 for a quote that is not there', async () => {
    const created = unwrap(
      await (await send('POST', '/quotations', toQuoteBody(quoteForm('Gone soon', [['1', '1']])))).json(),
      createdSchema,
    );
    expect((await send('DELETE', `/quotations/${created.id}`)).status).toBe(200);
    for (const [method, body] of [
      ['GET', undefined],
      ['PATCH', { title: 'Back' }],
      ['DELETE', undefined],
    ] as const) {
      expect((await send(method, `/quotations/${created.id}`, body)).status, method).toBe(404);
    }
  });
});
