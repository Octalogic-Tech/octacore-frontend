import { CORE_API, stubApi } from './api';

type Row = Record<string, unknown>;

const stamp = '2026-10-01T09:30:00.000000Z';

/** A row as the core service sends it: the audit fields come with every record. */
const record = (fields: Row): Row => ({ status: 1, createdDate: stamp, updatedDate: stamp, deletedDate: null, ...fields });

/** The core service wraps every answer in this envelope. */
const envelope = (data: unknown, statusCode = 200) => ({ statusCode, message: 'ok', data, meta: null });

/** A credentialed cross-origin answer must name the page's own origin and allow credentials. */
const corsHeaders = (origin: unknown) => ({
  'access-control-allow-origin': typeof origin === 'string' ? origin : 'http://localhost:3000',
  'access-control-allow-credentials': 'true',
});

function stubCore(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  answer: (request: { url: string; body: unknown }) => { statusCode?: number; body: unknown },
) {
  // XHRs only: the dev server can land on a port the app's own pages share with an API route.
  cy.intercept({ method, url: `${CORE_API}${path}`, resourceType: 'xhr' }, (req) => {
    const { statusCode = 200, body } = answer({ url: req.url, body: req.body });
    // `body`: an object that holds `statusCode` would otherwise be read by Cypress as the response itself.
    req.reply({ statusCode, body, headers: corsHeaders(req.headers.origin) });
  });
}

const softwareType = record({ id: 1, name: 'Software subscription', description: 'Tools we pay for' });
const dollars = record({ id: 1, code: 'USD', name: 'US dollar', symbol: '$', rate: 1 });
const rupees = record({ id: 2, code: 'INR', name: 'Indian rupee', symbol: '₹', rate: 88.25 });

/**
 * Everything `stubApi` stubs, plus the expense routes. They start empty and keep state, so adding a recurring expense
 * (which the stub answers by creating three monthly charges, August to October 2026) shows up on the next read.
 */
export function stubExpenses() {
  stubApi();
  let recurring: Row[] = [];
  let expenses: Row[] = [];

  stubCore('GET', '/expense-types', () => ({ body: envelope([softwareType]) }));
  stubCore('GET', '/currencies', () => ({ body: envelope([dollars, rupees]) }));
  stubCore('GET', '/recurring-expenses', () => ({ body: envelope(recurring) }));
  // `*` does not cross a `/`, and the list carries a query string, hence the trailing `*`.
  stubCore('GET', '/expenses*', () => ({ body: envelope(expenses) }));
  stubCore('GET', '/expenses/summary*', () => {
    const total = expenses.reduce((sum, expense) => sum + (expense.amountCents as number), 0);
    return {
      body: envelope({
        totalCents: total,
        count: expenses.length,
        byType: expenses.length
          ? [{ expenseTypeId: 1, name: 'Software subscription', totalCents: total, count: expenses.length }]
          : [],
        byMonth: [],
      }),
    };
  });

  stubCore('POST', '/recurring-expenses', ({ body }) => {
    const fields = body as Row;
    const created = record({
      id: 7,
      notes: null,
      projectId: null,
      project: null,
      endDate: null,
      state: 'active',
      nextChargeDate: '2026-11-01',
      lastChargeDate: '2026-10-01',
      expenseType: softwareType,
      currency: { id: 1, code: 'USD', symbol: '$' },
      amountCents: fields.amount,
      monthlyCostCents: fields.amount,
      yearlyCostCents: (fields.amount as number) * 12,
      ...fields,
    });
    recurring = [created];
    expenses = ['2026-10-01', '2026-09-01', '2026-08-01'].map((chargeDate, index) =>
      record({
        id: index + 1,
        name: fields.name,
        notes: null,
        expenseTypeId: 1,
        expenseType: { id: 1, name: 'Software subscription' },
        projectId: null,
        project: null,
        chargeDate,
        amountCents: fields.amount,
        originalCurrency: null,
        originalAmount: null,
        exchangeRate: null,
        recurringExpenseId: 7,
      }),
    );
    return { statusCode: 201, body: envelope({ ...created, generatedCount: 3 }, 201) };
  });
}
