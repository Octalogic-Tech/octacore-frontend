import { neutraliseFormula, toCsv } from '@/lib/csv';
import { toAmountText } from '@/lib/money';
import type { ExpenseRow } from './schema';

const HEADERS = [
  'Date',
  'Name',
  'Type',
  'Project',
  'Source',
  'Amount (USD)',
  'Original amount',
  'Original currency',
  'Rate',
  'Notes',
  'Person',
];

/**
 * One line per expense, as listed. Dates stay `YYYY-MM-DD` and amounts plain numbers (`15.00`), so a spreadsheet can
 * sort them; text a person typed goes through `neutraliseFormula` first.
 */
export function expensesToCsv(expenses: readonly ExpenseRow[]): string {
  return toCsv(
    HEADERS,
    expenses.map((expense) => [
      expense.chargeDate,
      neutraliseFormula(expense.name),
      neutraliseFormula(expense.expenseType.name),
      neutraliseFormula(expense.project?.name ?? ''),
      expense.recurringExpenseId === null ? 'One-time' : 'Recurring',
      toAmountText(expense.amountCents),
      expense.originalAmount === null ? '' : toAmountText(expense.originalAmount),
      expense.originalCountry?.currencyCode ?? '',
      expense.exchangeRate === null ? '' : String(expense.exchangeRate),
      neutraliseFormula(expense.notes),
      neutraliseFormula(expense.person?.name ?? ''),
    ]),
  );
}
