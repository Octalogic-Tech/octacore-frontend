import { billsToCsv, downloadCsv, neutraliseFormula } from './csv';
import type { Bill } from './types';

const make = (overrides: Partial<Bill> = {}): Bill => ({
  id: 1,
  billDate: '2023-08-10',
  amount: 100,
  billType: 'Bonus',
  actualExpense: false,
  billPath: '/path/to/bill/1',
  uploadedBy: 'John Doe',
  submittedBy: 'John Doe',
  approved: true,
  approvedBy: 'Manager',
  ...overrides,
});

const HEADER = 'Bill date,Amount,Bill type,Reimbursement,Uploaded by,Submitted by,Approved,Approved by,Bill file';

describe('billsToCsv', () => {
  it('writes a header and one CRLF-separated row per bill', () => {
    expect(billsToCsv([make(), make({ id: 2, amount: 200, actualExpense: true, approved: false, approvedBy: '' })])).toBe(
      [
        HEADER,
        '2023-08-10,100,Bonus,No,John Doe,John Doe,Yes,Manager,/path/to/bill/1',
        '2023-08-10,200,Bonus,Yes,John Doe,John Doe,No,,/path/to/bill/1',
      ].join('\r\n'),
    );
  });

  it('writes only the header when there are no bills', () => {
    expect(billsToCsv([])).toBe(HEADER);
  });

  it('quotes values containing commas, quotes and newlines', () => {
    const csv = billsToCsv([make({ uploadedBy: 'Doe, John', submittedBy: 'He said "hi"', approvedBy: 'Line1\nLine2' })]);
    expect(csv).toContain('"Doe, John"');
    expect(csv).toContain('"He said ""hi"""');
    expect(csv).toContain('"Line1\nLine2"');
  });

  it('stops a spreadsheet running a typed value as a formula', () => {
    const csv = billsToCsv([
      make({ uploadedBy: '=HYPERLINK("http://evil","x")', submittedBy: '+1', approvedBy: '-2', billPath: '@SUM(A1)' }),
    ]);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(csv).toContain(",'+1,");
    expect(csv).toContain(",'-2,");
    expect(csv).toContain(",'@SUM(A1)");
  });

  it('keeps a negative amount a number', () => {
    expect(billsToCsv([make({ amount: -5 })])).toContain(',-5,');
  });
});

describe('neutraliseFormula', () => {
  it('prefixes values a spreadsheet would run, and leaves the rest alone', () => {
    expect(neutraliseFormula('=1+1')).toBe("'=1+1");
    expect(neutraliseFormula('+1')).toBe("'+1");
    expect(neutraliseFormula('-1')).toBe("'-1");
    expect(neutraliseFormula('@x')).toBe("'@x");
    expect(neutraliseFormula('\tx')).toBe("'\tx");
    expect(neutraliseFormula('John Doe')).toBe('John Doe');
    expect(neutraliseFormula('')).toBe('');
  });
});

describe('downloadCsv', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads under the given name and releases the object URL', () => {
    const createObjectURL = vi.fn(() => 'blob:csv');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });

    downloadCsv('receipts.csv', 'a,b');

    expect(names).toEqual(['receipts.csv']);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:csv');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
