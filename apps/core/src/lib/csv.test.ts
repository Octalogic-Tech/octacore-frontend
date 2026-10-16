import { downloadCsv, neutraliseFormula, toCsv } from './csv';

describe('toCsv', () => {
  it('writes the header and one CRLF-separated row per entry', () => {
    expect(
      toCsv(
        ['A', 'B'],
        [
          ['1', 'x'],
          ['2', ''],
        ],
      ),
    ).toBe(['A,B', '1,x', '2,'].join('\r\n'));
  });

  it('writes only the header when there are no rows', () => {
    expect(toCsv(['A', 'B'], [])).toBe('A,B');
  });

  it('quotes values containing commas, quotes and newlines', () => {
    const csv = toCsv(['A', 'B', 'C'], [['Doe, John', 'He said "hi"', 'Line1\nLine2']]);
    expect(csv).toContain('"Doe, John"');
    expect(csv).toContain('"He said ""hi"""');
    expect(csv).toContain('"Line1\nLine2"');
  });

  it('writes a value as given: only the caller knows which ones are typed text', () => {
    expect(toCsv(['A'], [['=1+1'], ['-5']])).toBe(['A', '=1+1', '-5'].join('\r\n'));
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

    downloadCsv('invoices.csv', 'a,b');

    expect(names).toEqual(['invoices.csv']);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:csv');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
