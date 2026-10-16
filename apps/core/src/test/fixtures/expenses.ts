import { AxiosError, type AxiosResponse } from 'axios';

// Rows shaped like the core service's answers for the expense routes, in its envelope, with made-up values.
const stamp = '2026-10-01T09:30:00.000000Z';
const audit = { status: 1, createdDate: stamp, updatedDate: stamp, deletedDate: null };

export const expenseTypeRows = [
  { id: 1, ...audit, name: 'Software subscription', description: 'Tools we pay for' },
  { id: 2, ...audit, name: 'Travel', description: null },
];

export const currencyRows = [
  { id: 1, ...audit, code: 'USD', name: 'US dollar', symbol: '$', rate: 1 },
  { id: 2, ...audit, code: 'INR', name: 'Indian rupee', symbol: '₹', rate: 88.25 },
];

export const expenseRows = [
  {
    id: 1,
    ...audit,
    name: 'Figma',
    notes: null,
    expenseTypeId: 1,
    expenseType: { id: 1, name: 'Software subscription' },
    projectId: null,
    project: null,
    chargeDate: '2026-10-01',
    amountCents: 1500,
    originalCurrencyId: null,
    originalCurrency: null,
    originalAmount: null,
    exchangeRate: null,
    recurringExpenseId: 7,
  },
  {
    id: 2,
    ...audit,
    name: 'Co-working desk',
    notes: 'Pune',
    expenseTypeId: 2,
    expenseType: { id: 2, name: 'Travel' },
    projectId: 1,
    project: { id: 1, name: 'Website' },
    chargeDate: '2026-09-15',
    amountCents: 10000,
    originalCurrencyId: 2,
    originalCurrency: { id: 2, code: 'INR', symbol: '₹' },
    originalAmount: 882500,
    exchangeRate: 88.25,
    recurringExpenseId: null,
  },
];

export const recurringRows = [
  {
    id: 7,
    ...audit,
    name: 'Figma',
    notes: null,
    expenseTypeId: 1,
    expenseType: { id: 1, name: 'Software subscription' },
    projectId: null,
    project: null,
    currencyId: 1,
    currency: { id: 1, code: 'USD', symbol: '$' },
    amount: 1500,
    frequency: 'monthly',
    startDate: '2026-07-01',
    endDate: null,
    state: 'active',
    nextChargeDate: '2026-11-01',
    lastChargeDate: '2026-10-01',
    amountCents: 1500,
    monthlyCostCents: 1500,
    yearlyCostCents: 18000,
  },
  {
    id: 8,
    ...audit,
    name: 'Co-working desk',
    notes: 'Pune',
    expenseTypeId: 2,
    expenseType: { id: 2, name: 'Travel' },
    projectId: null,
    project: null,
    currencyId: 2,
    currency: { id: 2, code: 'INR', symbol: '₹' },
    amount: 882500,
    frequency: 'monthly',
    startDate: '2026-08-15',
    endDate: null,
    state: 'paused',
    nextChargeDate: '2026-11-15',
    lastChargeDate: '2026-10-15',
    amountCents: 10000,
    monthlyCostCents: 10000,
    yearlyCostCents: 120000,
  },
  {
    id: 9,
    ...audit,
    name: 'Old VPN',
    notes: null,
    expenseTypeId: 1,
    expenseType: { id: 1, name: 'Software subscription' },
    projectId: null,
    project: null,
    currencyId: 1,
    currency: { id: 1, code: 'USD', symbol: '$' },
    amount: 900,
    frequency: 'quarterly',
    startDate: '2026-01-10',
    endDate: '2026-07-10',
    state: 'cancelled',
    nextChargeDate: null,
    lastChargeDate: '2026-07-10',
    amountCents: 900,
    monthlyCostCents: 300,
    yearlyCostCents: 3600,
  },
];

export const summaryData = {
  totalCents: 11500,
  count: 2,
  byType: [
    { expenseTypeId: 2, name: 'Travel', totalCents: 10000, count: 1 },
    { expenseTypeId: 1, name: 'Software subscription', totalCents: 1500, count: 1 },
  ],
  byMonth: [
    { month: '2026-09', totalCents: 10000 },
    { month: '2026-10', totalCents: 1500 },
  ],
};

export const expensesEnvelope = (data: unknown) => ({ statusCode: 200, message: 'ok', data, meta: null });

/** What a failed call rejects with: the service's own message sits in the body of its answer. */
export const rejection = (status: number, message: string) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, {
    status,
    data: { statusCode: status, message, data: null },
  } as AxiosResponse);

/**
 * A `coreApi.get` implementation that answers by path, in the service's envelope, and fails loudly on a path the
 * test did not expect: `vi.mocked(coreApi.get).mockImplementation(answering({ '/currencies': currencyRows }))`.
 */
export const answering = (answers: Record<string, unknown>) => async (url: string) => {
  if (!(url in answers)) throw new Error(`Unexpected GET ${url}`);
  return { data: expensesEnvelope(answers[url]) } as never;
};
