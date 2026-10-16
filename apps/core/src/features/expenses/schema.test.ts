import { currencyRows, expenseRows, recurringRows } from '@/test/fixtures/expenses';
import {
  emptyExpenseForm,
  emptyRecurringForm,
  expenseFormSchema,
  expenseRowSchema,
  recurringFormSchema,
  recurringRowSchema,
  shownAmount,
  toExpenseBody,
  toExpenseFormValues,
  toRecurringBody,
  toRecurringFormValues,
  type ExpenseFormValues,
  type RecurringFormValues,
} from './schema';

const expense = expenseRowSchema.parse(expenseRows[1]); // typed in rupees
const dollarExpense = expenseRowSchema.parse(expenseRows[0]);
const recurring = recurringRowSchema.parse(recurringRows[0]);

const valid: ExpenseFormValues = {
  name: 'Figma',
  expenseTypeId: '1',
  projectId: '',
  chargeDate: '2026-10-01',
  currencyId: '1',
  amount: '15.00',
  notes: '',
};

describe('the expense form', () => {
  it('accepts a complete form', () => {
    expect(expenseFormSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['name', { name: '   ' }, 'Name is required'],
    ['expenseTypeId', { expenseTypeId: '' }, 'Choose a type'],
    ['chargeDate', { chargeDate: '' }, 'Charge date is required'],
    ['currencyId', { currencyId: '' }, 'Choose a currency'],
    ['amount', { amount: '' }, 'Enter an amount'],
    ['amount', { amount: '1,000' }, 'Enter an amount like 7.20, with no commas or signs'],
    ['amount', { amount: '0' }, 'The amount must be more than zero'],
  ])('refuses a bad %s', (field, override, message) => {
    const result = expenseFormSchema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    const issues = result.success ? [] : result.error.issues;
    expect(issues.find((issue) => issue.path[0] === field)?.message).toBe(message);
  });
});

describe('the expense body', () => {
  it('sends the currency and the amount in minor units on a create', () => {
    expect(toExpenseBody({ ...valid, projectId: '3', notes: ' Seats ' })).toEqual({
      name: 'Figma',
      notes: 'Seats',
      expenseTypeId: 1,
      projectId: 3,
      chargeDate: '2026-10-01',
      currencyId: 1,
      amount: 1500,
    });
  });

  it('sends a blank note and project as null', () => {
    const body = toExpenseBody(valid);
    expect(body.notes).toBeNull();
    expect(body.projectId).toBeNull();
  });

  // The service converts again, at today's rate, whenever it is sent a currency and an amount.
  describe('on an edit', () => {
    const shown = { currencyId: 2, amount: 882500 };
    const form = { ...valid, currencyId: '2', amount: '8825.00' };

    it('leaves the amount out when neither it nor the currency changed', () => {
      const body = toExpenseBody({ ...form, notes: 'Rent' }, shown);
      expect('currencyId' in body).toBe(false);
      expect('amount' in body).toBe(false);
      expect(body.notes).toBe('Rent');
    });

    it('sends both when the amount changed', () => {
      expect(toExpenseBody({ ...form, amount: '9000.00' }, shown)).toMatchObject({ currencyId: 2, amount: 900000 });
    });

    it('sends both when the currency changed', () => {
      expect(toExpenseBody({ ...form, currencyId: '1' }, shown)).toMatchObject({ currencyId: 1, amount: 882500 });
    });

    it('treats 8825 and 8825.00 as the same amount', () => {
      expect('amount' in toExpenseBody({ ...form, amount: '8825' }, shown)).toBe(false);
    });
  });
});

describe('what an expense is shown with', () => {
  it('is the rupee amount typed, for a rupee expense', () => {
    expect(shownAmount(expense, 1)).toEqual({ currencyId: 2, amount: 882500 });
  });

  it('is the dollar amount, for a dollar expense', () => {
    expect(shownAmount(dollarExpense, 1)).toEqual({ currencyId: 1, amount: 1500 });
  });

  it('is unknown while the dollar currency has not loaded', () => {
    expect(shownAmount(dollarExpense, undefined)).toBeUndefined();
    expect(shownAmount(expense, undefined)).toEqual({ currencyId: 2, amount: 882500 });
  });
});

describe('the expense form values', () => {
  it('start empty with today as the charge date on a new expense', () => {
    expect(toExpenseFormValues(undefined, '2026-10-16')).toEqual({
      ...emptyExpenseForm,
      chargeDate: '2026-10-16',
    });
  });

  it('show a rupee expense in rupees', () => {
    expect(toExpenseFormValues(expense, '2026-10-16')).toMatchObject({
      name: 'Co-working desk',
      currencyId: '2',
      amount: '8825.00',
      projectId: '1',
      notes: 'Pune',
    });
  });

  it('leave the currency of a dollar expense for the form to fill in', () => {
    expect(toExpenseFormValues(dollarExpense, '2026-10-16')).toMatchObject({ currencyId: '', amount: '15.00' });
  });
});

const validRecurring: RecurringFormValues = {
  name: 'Figma',
  expenseTypeId: '1',
  projectId: '',
  frequency: 'monthly',
  startDate: '2026-07-01',
  endDate: '',
  currencyId: '1',
  amount: '15.00',
  notes: '',
};

describe('the recurring form', () => {
  it('accepts a complete form, with or without an end date', () => {
    expect(recurringFormSchema.safeParse(validRecurring).success).toBe(true);
    expect(recurringFormSchema.safeParse({ ...validRecurring, endDate: '2027-06-30' }).success).toBe(true);
  });

  it.each([
    ['frequency', { frequency: '' }, 'Choose how often it is charged'],
    ['startDate', { startDate: '' }, 'Start date is required'],
    ['startDate', { startDate: '1999-12-31' }, 'The start date must be between the years 2000 and 2100'],
    ['startDate', { startDate: '2101-01-01' }, 'The start date must be between the years 2000 and 2100'],
    ['endDate', { endDate: '2026-06-30' }, 'The end date must not be before the start date'],
    ['endDate', { endDate: '9999-12-31' }, 'The end date must be between the years 2000 and 2100'],
    ['amount', { amount: '7.999' }, 'Enter an amount like 7.20, with no commas or signs'],
  ])('refuses a bad %s', (field, override, message) => {
    const result = recurringFormSchema.safeParse({ ...validRecurring, ...override });
    expect(result.success).toBe(false);
    const issues = result.success ? [] : result.error.issues;
    expect(issues.find((issue) => issue.path[0] === field)?.message).toBe(message);
  });

  it('builds the body, with a blank end date as null', () => {
    expect(toRecurringBody({ ...validRecurring, notes: ' Seats ', projectId: '3' })).toEqual({
      name: 'Figma',
      notes: 'Seats',
      expenseTypeId: 1,
      projectId: 3,
      currencyId: 1,
      amount: 1500,
      frequency: 'monthly',
      startDate: '2026-07-01',
      endDate: null,
    });
  });

  it('starts from monthly and today on a new expense, and from the row on an edit', () => {
    expect(toRecurringFormValues(undefined, '2026-10-16')).toEqual({
      ...emptyRecurringForm,
      startDate: '2026-10-16',
    });
    expect(toRecurringFormValues(recurring, '2026-10-16')).toMatchObject({
      name: 'Figma',
      frequency: 'monthly',
      startDate: '2026-07-01',
      endDate: '',
      currencyId: '1',
      amount: '15.00',
    });
  });
});

describe('the rows', () => {
  it('read a note the service holds as null as an empty one', () => {
    expect(dollarExpense.notes).toBe('');
  });

  it('read a recurring expense with its calculated costs', () => {
    expect(recurring).toMatchObject({ amountCents: 1500, monthlyCostCents: 1500, yearlyCostCents: 18000 });
  });

  it('refuse a row with an unknown frequency', () => {
    expect(recurringRowSchema.safeParse({ ...recurringRows[0], frequency: 'weekly' }).success).toBe(false);
  });

  it('are built from rows with a currency to show', () => {
    expect(currencyRows.map((row) => row.code)).toEqual(['USD', 'INR']);
  });
});
