import { expenseRows } from '@/test/fixtures/expenses';
import { expensesToCsv } from './csv';
import { expenseRowsSchema } from './schema';

const rows = expenseRowsSchema.parse(expenseRows);

describe('expensesToCsv', () => {
  it('writes a header and one line per expense, amounts as plain numbers', () => {
    const lines = expensesToCsv(rows).split('\r\n');

    expect(lines[0]).toBe('Date,Name,Type,Project,Source,Amount (USD),Original amount,Original currency,Rate,Notes');
    expect(lines[1]).toBe('2026-10-01,Figma,Software subscription,,Recurring,15.00,,,,');
    expect(lines[2]).toBe('2026-09-15,Co-working desk,Travel,Website,One-time,100.00,8825.00,INR,88.25,Pune');
    expect(lines).toHaveLength(3);
  });

  it('stops a spreadsheet running a typed name or note as a formula', () => {
    const csv = expensesToCsv([{ ...rows[0], name: '=1+1', notes: '@cmd' }]);

    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'@cmd");
  });

  it('quotes a name with a comma', () => {
    expect(expensesToCsv([{ ...rows[0], name: 'Desk, Pune' }])).toContain('"Desk, Pune"');
  });

  it('is just the header with no expenses', () => {
    expect(expensesToCsv([])).toBe('Date,Name,Type,Project,Source,Amount (USD),Original amount,Original currency,Rate,Notes');
  });
});
