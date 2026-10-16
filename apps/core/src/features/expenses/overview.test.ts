import { expenseRows } from '@/test/fixtures/expenses';
import { monthFigures } from './overview';
import { expenseRowsSchema } from './schema';

const [figma, desk] = expenseRowsSchema.parse(expenseRows); // figma: recurring, $15; desk: one-time, $100

describe('monthFigures', () => {
  it('adds up the month, and splits it into recurring and one-time', () => {
    expect(monthFigures([figma, desk])).toMatchObject({ total: 11500, recurring: 1500, oneTime: 10000, count: 2 });
  });

  it('totals by type, the biggest first, with each type’s count', () => {
    const another = { ...figma, id: 9, amountCents: 500 };

    expect(monthFigures([figma, desk, another]).byType).toEqual([
      { expenseTypeId: 2, name: 'Travel', totalCents: 10000, count: 1 },
      { expenseTypeId: 1, name: 'Software subscription', totalCents: 2000, count: 2 },
    ]);
  });

  it('breaks a tie by name', () => {
    const a = { ...figma, expenseTypeId: 5, expenseType: { id: 5, name: 'Alpha' }, amountCents: 100 };
    const b = { ...figma, id: 8, expenseTypeId: 6, expenseType: { id: 6, name: 'Beta' }, amountCents: 100 };

    expect(monthFigures([b, a]).byType.map((row) => row.name)).toEqual(['Alpha', 'Beta']);
  });

  it('is all zeroes for no expenses', () => {
    expect(monthFigures([])).toEqual({ total: 0, oneTime: 0, recurring: 0, count: 0, byType: [] });
  });
});
