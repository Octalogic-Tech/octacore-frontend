import { z } from 'zod';
import { amountProblem, parseAmount, toAmountText } from './money';

const nullToEmpty = (text: string | null) => text ?? '';
const orNull = (text: string) => (text === '' ? null : text);

const refSchema = z.object({ id: z.number().int(), name: z.string() });
const currencyRefSchema = z.object({ id: z.number().int(), code: z.string(), symbol: z.string() });

// Only what the pages use. The service also sends `status` and the audit dates; unknown keys are dropped.
export const expenseRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  notes: z.string().nullable().transform(nullToEmpty),
  expenseTypeId: z.number().int(),
  expenseType: refSchema,
  projectId: z.number().int().nullable(),
  project: refSchema.nullable(),
  // The person the expense is for; kept by name even after the person is deleted.
  personId: z.number().int().nullable(),
  person: refSchema.nullable(),
  chargeDate: z.iso.date(),
  // US cents: what every total adds up.
  amountCents: z.number().int(),
  // Set only for a charge typed in a currency other than USD: what was typed and the rate used.
  originalCurrency: currencyRefSchema.nullable(),
  originalAmount: z.number().int().nullable(),
  exchangeRate: z.number().nullable(),
  // Set on an expense the service made from a recurring expense.
  recurringExpenseId: z.number().int().nullable(),
});

export const expenseRowsSchema = z.array(expenseRowSchema);

export type ExpenseRow = z.output<typeof expenseRowSchema>;

export const expenseSummarySchema = z.object({
  totalCents: z.number().int(),
  count: z.number().int(),
  byType: z.array(
    z.object({
      expenseTypeId: z.number().int(),
      name: z.string(),
      totalCents: z.number().int(),
      count: z.number().int(),
    }),
  ),
  // `2026-09`, oldest first; a month with no spend is left out.
  byMonth: z.array(z.object({ month: z.string(), totalCents: z.number().int() })),
});

export type ExpenseSummary = z.output<typeof expenseSummarySchema>;

export const frequencySchema = z.enum(['monthly', 'quarterly', 'yearly']);
export type Frequency = z.infer<typeof frequencySchema>;
export const FREQUENCY_LABELS: Record<Frequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};
export const FREQUENCY_OPTIONS = frequencySchema.options.map((value) => ({ value, label: FREQUENCY_LABELS[value] }));

export const stateSchema = z.enum(['active', 'paused', 'cancelled']);
export type RecurringState = z.infer<typeof stateSchema>;
export const STATE_LABELS: Record<RecurringState, string> = {
  active: 'Active',
  paused: 'Paused',
  cancelled: 'Cancelled',
};

export const recurringRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  notes: z.string().nullable().transform(nullToEmpty),
  expenseTypeId: z.number().int(),
  expenseType: refSchema,
  projectId: z.number().int().nullable(),
  project: refSchema.nullable(),
  // The person the expense is for; kept by name even after the person is deleted.
  personId: z.number().int().nullable(),
  person: refSchema.nullable(),
  currencyId: z.number().int(),
  currency: currencyRefSchema,
  // One charge in the currency's own minor units.
  amount: z.number().int(),
  frequency: frequencySchema,
  startDate: z.iso.date(),
  endDate: z.iso.date().nullable(),
  state: stateSchema,
  nextChargeDate: z.iso.date().nullable(),
  lastChargeDate: z.iso.date().nullable(),
  // Calculated by the service from the amount and the currency's current rate, in US cents.
  amountCents: z.number().int(),
  monthlyCostCents: z.number().int(),
  yearlyCostCents: z.number().int(),
});

export const recurringRowsSchema = z.array(recurringRowSchema);

export type RecurringRow = z.output<typeof recurringRowSchema>;

// ---- The expense form. Every field is text, so a blank field can be told from a typed one.

export const expenseFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    expenseTypeId: z.string().min(1, 'Choose a type'),
    projectId: z.string(),
    personId: z.string(),
    chargeDate: z.string().min(1, 'Charge date is required'),
    currencyId: z.string().min(1, 'Choose a currency'),
    amount: z.string(),
    notes: z.string().trim(),
  })
  .superRefine((values, context) => {
    const problem = amountProblem(values.amount);
    if (problem) context.addIssue({ code: 'custom', path: ['amount'], message: problem });
  });

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export const emptyExpenseForm: ExpenseFormValues = {
  name: '',
  expenseTypeId: '',
  projectId: '',
  personId: '',
  chargeDate: '',
  currencyId: '',
  amount: '',
  notes: '',
};

/**
 * The form for a new expense (today as the charge date) or for an edit. A dollar expense leaves the currency empty:
 * the dialog fills in US dollars once the currency list says which row that is.
 */
export function toExpenseFormValues(expense: ExpenseRow | undefined, today: string): ExpenseFormValues {
  if (!expense) return { ...emptyExpenseForm, chargeDate: today };
  return {
    name: expense.name,
    expenseTypeId: String(expense.expenseTypeId),
    projectId: expense.projectId === null ? '' : String(expense.projectId),
    personId: expense.personId === null ? '' : String(expense.personId),
    chargeDate: expense.chargeDate,
    currencyId: expense.originalCurrency ? String(expense.originalCurrency.id) : '',
    amount: toAmountText(expense.originalAmount ?? expense.amountCents),
    notes: expense.notes,
  };
}

/** The currency and amount an expense is shown with (what was typed), or undefined while US dollars are unknown. */
export function shownAmount(
  expense: ExpenseRow,
  usdId: number | undefined,
): { currencyId: number; amount: number } | undefined {
  const currencyId = expense.originalCurrency?.id ?? usdId;
  if (currencyId === undefined) return undefined;
  return { currencyId, amount: expense.originalAmount ?? expense.amountCents };
}

export interface ExpenseBody {
  name: string;
  notes: string | null;
  expenseTypeId: number;
  projectId: number | null;
  personId: number | null;
  chargeDate: string;
  currencyId?: number;
  amount?: number;
}

/**
 * The body to send. On an edit, pass what the expense is shown with: the currency and amount are then sent only when
 * one of them changed, because the service converts again at today's rate whenever it receives them, and an edit of
 * the notes must not rewrite a saved rupee charge.
 */
export function toExpenseBody(
  values: ExpenseFormValues,
  shown?: { currencyId: number; amount: number },
): ExpenseBody {
  const currencyId = Number(values.currencyId);
  const amount = parseAmount(values.amount);
  const body: ExpenseBody = {
    name: values.name,
    notes: orNull(values.notes.trim()),
    expenseTypeId: Number(values.expenseTypeId),
    projectId: values.projectId === '' ? null : Number(values.projectId),
    personId: values.personId === '' ? null : Number(values.personId),
    chargeDate: values.chargeDate,
  };
  if (!shown || shown.currencyId !== currencyId || shown.amount !== amount) {
    body.currencyId = currencyId;
    body.amount = amount;
  }
  return body;
}

// ---- The recurring expense form.

/** A schedule date as a date input holds it, in the years the service accepts. Blank is not a problem here. */
function scheduleDateProblem(value: string, label: string): string | null {
  if (value === '') return null;
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(value);
  const year = match ? Number(match[1]) : NaN;
  return year >= 2000 && year <= 2100 ? null : `${label} must be between the years 2000 and 2100`;
}

export const recurringFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    expenseTypeId: z.string().min(1, 'Choose a type'),
    projectId: z.string(),
    personId: z.string(),
    frequency: z.string().min(1, 'Choose how often it is charged'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string(),
    currencyId: z.string().min(1, 'Choose a currency'),
    amount: z.string(),
    notes: z.string().trim(),
  })
  .superRefine((values, context) => {
    const issue = (path: string, message: string) => context.addIssue({ code: 'custom', path: [path], message });
    const amount = amountProblem(values.amount);
    if (amount) issue('amount', amount);
    const start = scheduleDateProblem(values.startDate, 'The start date');
    if (start) issue('startDate', start);
    const end = scheduleDateProblem(values.endDate, 'The end date');
    if (end) issue('endDate', end);
    else if (values.endDate !== '' && values.startDate !== '' && values.endDate < values.startDate) {
      issue('endDate', 'The end date must not be before the start date');
    }
  });

export type RecurringFormValues = z.infer<typeof recurringFormSchema>;

export const emptyRecurringForm: RecurringFormValues = {
  name: '',
  expenseTypeId: '',
  projectId: '',
  personId: '',
  frequency: 'monthly',
  startDate: '',
  endDate: '',
  currencyId: '',
  amount: '',
  notes: '',
};

export function toRecurringFormValues(row: RecurringRow | undefined, today: string): RecurringFormValues {
  if (!row) return { ...emptyRecurringForm, startDate: today };
  return {
    name: row.name,
    expenseTypeId: String(row.expenseTypeId),
    projectId: row.projectId === null ? '' : String(row.projectId),
    personId: row.personId === null ? '' : String(row.personId),
    frequency: row.frequency,
    startDate: row.startDate,
    endDate: row.endDate ?? '',
    currencyId: String(row.currencyId),
    amount: toAmountText(row.amount),
    notes: row.notes,
  };
}

export interface RecurringBody {
  name: string;
  notes: string | null;
  expenseTypeId: number;
  projectId: number | null;
  personId: number | null;
  currencyId: number;
  amount: number;
  frequency: Frequency;
  startDate: string;
  endDate: string | null;
}

/** An edit sends everything: the service changes future charges only, and ignores a start date that did not move. */
export function toRecurringBody(values: RecurringFormValues): RecurringBody {
  return {
    name: values.name,
    notes: orNull(values.notes.trim()),
    expenseTypeId: Number(values.expenseTypeId),
    projectId: values.projectId === '' ? null : Number(values.projectId),
    personId: values.personId === '' ? null : Number(values.personId),
    currencyId: Number(values.currencyId),
    amount: parseAmount(values.amount),
    frequency: frequencySchema.parse(values.frequency),
    startDate: values.startDate,
    endDate: orNull(values.endDate),
  };
}
