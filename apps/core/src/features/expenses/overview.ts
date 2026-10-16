import type { ExpenseRow } from './schema';

export interface TypeFigure {
  expenseTypeId: number;
  name: string;
  totalCents: number;
  count: number;
}

export interface MonthFigures {
  /** US cents. */
  total: number;
  /** The part of the total that expenses typed in by hand make up. */
  oneTime: number;
  /** The part that charges a recurring expense created make up. */
  recurring: number;
  count: number;
  byType: TypeFigure[];
}

/**
 * The figures of the expenses listed: summed from the rows themselves, so they can never disagree with the list
 * beneath them. Types are ordered by total, the biggest first, then by name.
 */
export function monthFigures(rows: readonly ExpenseRow[]): MonthFigures {
  const figures: MonthFigures = { total: 0, oneTime: 0, recurring: 0, count: rows.length, byType: [] };
  const byType = new Map<number, TypeFigure>();
  for (const row of rows) {
    figures.total += row.amountCents;
    if (row.recurringExpenseId === null) figures.oneTime += row.amountCents;
    else figures.recurring += row.amountCents;
    const type = byType.get(row.expenseTypeId) ?? {
      expenseTypeId: row.expenseTypeId,
      name: row.expenseType.name,
      totalCents: 0,
      count: 0,
    };
    type.totalCents += row.amountCents;
    type.count += 1;
    byType.set(row.expenseTypeId, type);
  }
  figures.byType = [...byType.values()].sort((a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name));
  return figures;
}
