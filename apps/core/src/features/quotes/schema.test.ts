import { quoteRows } from '@/test/fixtures/quotes';
import { quoteTotals } from './calc';
import {
  SETTINGS_FIELDS,
  blankQuoteLine,
  emptyQuoteForm,
  quoteFormSchema,
  quoteRowSchema,
  quoteRowsSchema,
  quoteTooLarge,
  toCalcInput,
  toQuoteBody,
  toQuoteFormValues,
  type QuoteFormValues,
} from './schema';

const quotes = quoteRowsSchema.parse(quoteRows);
const [workbook, rounding] = quotes;

const TOO_LARGE = 'The quote comes to more than 100,000,000.00. Reduce the hours or the rates.';

type LineValues = QuoteFormValues['lines'][number];

const line = (over: Partial<LineValues> = {}): LineValues => ({
  description: 'Home page',
  units: '1',
  hoursPerUnit: '16',
  ...over,
});

const form = (over: Partial<QuoteFormValues> = {}): QuoteFormValues => ({
  ...emptyQuoteForm,
  title: 'Storefront',
  lines: [line()],
  ...over,
});

const issuesOf = (values: QuoteFormValues) => {
  const result = quoteFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues;
};

const messagesOf = (values: QuoteFormValues) => issuesOf(values).map((issue) => issue.message);

/** The mirror's totals for the form as it stands: the settings must be valid, or this throws as the editor never would. */
const totalsOf = (values: QuoteFormValues) => {
  const { settings, lines } = toCalcInput(values);
  if (settings === null) throw new Error('the settings are not valid');
  return quoteTotals(settings, lines);
};

const maximalLines = (count = 200): LineValues[] =>
  Array.from({ length: count }, () => line({ units: '100000', hoursPerUnit: '10000' }));

describe('quote row schema', () => {
  it('reads the service rows, keeping the settings, the lines and the totals and dropping the rest', () => {
    expect(workbook).toMatchObject({
      id: 1,
      title: 'Acme storefront',
      currencyCode: 'INR',
      developerRateCents: 310_000,
      negotiationBufferPercent: 25,
      hoursPerMonth: 160,
    });
    expect(workbook.lines).toHaveLength(53);
    expect(workbook.lines[0]).toEqual({ id: 1, description: 'Workbook item 1', units: 1, hoursPerUnit: 16 });
    expect(workbook.totals).toMatchObject({ baseHours: 1188, elapsedMonths: 2.48, finalQuoteCents: 571_725_000 });
    expect(rounding.negotiationBufferPercent).toBe(7.5);
    expect(rounding.lines[2].hoursPerUnit).toBe(12.34);
    expect(rounding.totals.personDays).toBe(5.19);
    // Audit columns are not read.
    expect(workbook).not.toHaveProperty('createdDate');
    expect(workbook).not.toHaveProperty('status');
    expect(workbook).toHaveProperty('updatedDate');
  });

  it('refuses a row whose totals or lines are missing or of the wrong type', () => {
    expect(quoteRowSchema.safeParse({ ...quoteRows[0], totals: undefined }).success).toBe(false);
    expect(quoteRowSchema.safeParse({ ...quoteRows[0], lines: undefined }).success).toBe(false);
    expect(
      quoteRowSchema.safeParse({ ...quoteRows[0], totals: { ...quoteRows[0].totals, finalQuoteCents: '571725000' } })
        .success,
    ).toBe(false);
    expect(quoteRowSchema.safeParse({ ...quoteRows[0], developerRateCents: '310000' }).success).toBe(false);
    // The json-server mock answers a bare array: not this service.
    expect(quoteRowsSchema.safeParse([{ id: 1, title: 'Mock' }]).success).toBe(false);
  });

  it('holds figures the mirror reproduces: the fixture totals are what the form would show', () => {
    for (const row of quotes) {
      const mirror = totalsOf(toQuoteFormValues(row));
      for (const [name, value] of Object.entries(row.totals)) {
        const mirrored = mirror[name as keyof typeof mirror];
        // Hours, person-days and months are hundredths in the mirror and decimal numbers on the wire.
        const wire = name.endsWith('Cents') ? value : Math.round(value * 100);
        expect([row.id, name, mirrored]).toEqual([row.id, name, wire]);
      }
    }
  });
});

describe('the new quote form', () => {
  it('starts from the defaults: INR, 3 developers at 3100.00, a manager at 3000.00, a free tester, one blank line', () => {
    expect(emptyQuoteForm).toEqual({
      title: '',
      currencyCode: 'INR',
      developerCount: '3',
      developerRate: '3100.00',
      managerCount: '1',
      managerRate: '3000.00',
      testerCount: '1',
      testerRate: '0.00',
      negotiationBufferPercent: '25',
      managementPercent: '25',
      testingPercent: '0',
      bugFixPercent: '0',
      hoursPerDay: '6',
      hoursPerMonth: '160',
      lines: [{ description: '', units: '1', hoursPerUnit: '' }],
    });
    expect(blankQuoteLine).toEqual({ description: '', units: '1', hoursPerUnit: '' });
  });

  it('opens a new quote on the defaults, with a line of its own that editing cannot share', () => {
    const opened = toQuoteFormValues();
    expect(opened).toEqual(emptyQuoteForm);
    expect(opened.lines[0]).not.toBe(emptyQuoteForm.lines[0]);
    expect(opened.lines[0]).not.toBe(blankQuoteLine);
  });

  it('lists every setting, and neither the title nor the lines, so the editor can tell the drawer from the table', () => {
    expect([...SETTINGS_FIELDS].sort()).toEqual(
      Object.keys(emptyQuoteForm)
        .filter((name) => name !== 'title' && name !== 'lines')
        .sort(),
    );
    expect(SETTINGS_FIELDS).toContain('currencyCode');
    expect(SETTINGS_FIELDS).toContain('testerRate');
  });
});

describe('toQuoteBody', () => {
  it('turns rates into cents, percents and hours into numbers, trims text and writes the currency in capitals', () => {
    const body = toQuoteBody(
      form({
        title: '  Storefront  ',
        currencyCode: ' inr ',
        developerRate: ' 3100.00 ',
        managerRate: '3000.5',
        testerRate: '0.00',
        negotiationBufferPercent: '7.5',
        managementPercent: ' 25 ',
        lines: [line({ description: '  Home page ', units: ' 2 ', hoursPerUnit: ' 7.5 ' })],
      }),
    );
    expect(body).toEqual({
      title: 'Storefront',
      currencyCode: 'INR',
      developerCount: 3,
      developerRateCents: 310_000,
      managerCount: 1,
      managerRateCents: 300_050,
      testerCount: 1,
      testerRateCents: 0,
      negotiationBufferPercent: 7.5,
      managementPercent: 25,
      testingPercent: 0,
      bugFixPercent: 0,
      hoursPerDay: 6,
      hoursPerMonth: 160,
      lines: [{ description: 'Home page', units: 2, hoursPerUnit: 7.5 }],
    });
  });

  it('is the fixture row, flat, once the row is made into form values and back', () => {
    for (const row of quotes) {
      expect(toQuoteBody(toQuoteFormValues(row))).toEqual({
        title: row.title,
        currencyCode: row.currencyCode,
        developerCount: row.developerCount,
        developerRateCents: row.developerRateCents,
        managerCount: row.managerCount,
        managerRateCents: row.managerRateCents,
        testerCount: row.testerCount,
        testerRateCents: row.testerRateCents,
        negotiationBufferPercent: row.negotiationBufferPercent,
        managementPercent: row.managementPercent,
        testingPercent: row.testingPercent,
        bugFixPercent: row.bugFixPercent,
        hoursPerDay: row.hoursPerDay,
        hoursPerMonth: row.hoursPerMonth,
        lines: row.lines.map(({ description, units, hoursPerUnit }) => ({ description, units, hoursPerUnit })),
      });
    }
  });
});

describe('toQuoteFormValues', () => {
  it('shows rates as 3100.00 and percents and hours as the numbers the service sent', () => {
    expect(toQuoteFormValues(workbook)).toMatchObject({
      title: 'Acme storefront',
      currencyCode: 'INR',
      developerCount: '3',
      developerRate: '3100.00',
      managerRate: '3000.00',
      testerRate: '0.00',
      negotiationBufferPercent: '25',
      hoursPerMonth: '160',
    });
    expect(toQuoteFormValues(workbook).lines).toHaveLength(53);
    expect(toQuoteFormValues(workbook).lines[0]).toEqual({
      description: 'Workbook item 1',
      units: '1',
      hoursPerUnit: '16',
    });
    expect(toQuoteFormValues(rounding)).toMatchObject({
      developerRate: '1234.56',
      testerRate: '999.99',
      negotiationBufferPercent: '7.5',
      managementPercent: '12.5',
    });
    expect(toQuoteFormValues(rounding).lines.map((entry) => entry.hoursPerUnit)).toEqual(['7.5', '0.25', '12.34']);
  });

  it('gives a saved quote that somehow has no lines one blank line to type into', () => {
    expect(toQuoteFormValues({ ...workbook, lines: [] }).lines).toEqual([blankQuoteLine]);
  });

  it('is a form the schema accepts', () => {
    for (const row of quotes) expect(messagesOf(toQuoteFormValues(row))).toEqual([]);
  });
});

describe('quoteFormSchema', () => {
  it('accepts the defaults with a title and a line', () => {
    expect(messagesOf(form())).toEqual([]);
  });

  it('asks for a title', () => {
    expect(messagesOf(form({ title: '   ' }))).toEqual(['Title is required']);
  });

  it('asks for a line, and allows no more than 200', () => {
    expect(messagesOf(form({ lines: [] }))).toEqual(['Add at least one line']);
    expect(messagesOf(form({ lines: Array.from({ length: 200 }, () => line()) }))).toEqual([]);
    expect(messagesOf(form({ lines: Array.from({ length: 201 }, () => line()) }))).toEqual([
      'A quote can have up to 200 lines',
    ]);
  });

  it('asks for a description on a line', () => {
    expect(messagesOf(form({ lines: [line({ description: ' ' })] }))).toEqual(['Description is required']);
  });

  describe('units', () => {
    it.each([
      ['', 'Units are required'],
      ['0', 'Units must be from 1 to 100,000'],
      ['100001', 'Units must be from 1 to 100,000'],
      ['1.5', 'Enter a whole number, like 3'],
      ['1,000', 'Enter a whole number, like 3'],
      ['-1', 'Enter a whole number, like 3'],
      ['abc', 'Enter a whole number, like 3'],
    ])('tells %j: %s', (units, message) => {
      const issues = issuesOf(form({ lines: [line({ units })] }));
      expect(issues.map((issue) => issue.message)).toEqual([message]);
      expect(issues[0].path).toEqual(['lines', 0, 'units']);
    });

    it.each(['1', '100000', ' 7 '])('accepts %j', (units) => {
      // At a hundredth of an hour each, so the quote itself is not too large.
      expect(messagesOf(form({ lines: [line({ units, hoursPerUnit: '0.01' })] }))).toEqual([]);
    });
  });

  describe('hours per unit', () => {
    const shape = 'Enter hours like 7.5, with up to two decimals and no commas or signs';
    it.each([
      ['', 'Hours are required'],
      ['0', 'Hours must be more than 0'],
      ['0.00', 'Hours must be more than 0'],
      ['.5', shape],
      ['1,5', shape],
      ['1e3', shape],
      ['-1', shape],
      ['0.005', shape],
      ['10000.01', 'Hours must be 10,000 or less'],
      ['10001', 'Hours must be 10,000 or less'],
    ])('tells %j: %s', (hoursPerUnit, message) => {
      const issues = issuesOf(form({ lines: [line({ hoursPerUnit })] }));
      expect(issues.map((issue) => issue.message)).toEqual([message]);
      expect(issues[0].path).toEqual(['lines', 0, 'hoursPerUnit']);
    });

    it.each(['0.5', '0.01', '16', '7.5', '12.34', '10000', '10000.00', ' 8 '])('accepts %j', (hoursPerUnit) => {
      expect(messagesOf(form({ lines: [line({ hoursPerUnit })] }))).toEqual([]);
    });
  });

  describe('percentages', () => {
    it.each(['negotiationBufferPercent', 'managementPercent', 'testingPercent', 'bugFixPercent'] as const)(
      '%s',
      (name) => {
        const problems: [string, string][] = [
          ['', 'Percentage is required'],
          ['100.01', 'Percentage must be from 0 to 100'],
          ['101', 'Percentage must be from 0 to 100'],
          ['-1', 'Enter a percentage like 7.5'],
          ['12.345', 'Enter a percentage like 7.5'],
          ['abc', 'Enter a percentage like 7.5'],
          ['7,5', 'Enter a percentage like 7.5'],
          ['25%', 'Enter a percentage like 7.5'],
        ];
        for (const [text, message] of problems) {
          const issues = issuesOf(form({ [name]: text }));
          expect([text, issues.map((issue) => issue.message)]).toEqual([text, [message]]);
          expect(issues[0].path).toEqual([name]);
        }
        for (const text of ['0', '0.00', '7.5', '25', '100', '100.00', ' 12.25 ']) {
          expect([text, messagesOf(form({ [name]: text }))]).toEqual([text, []]);
        }
      },
    );
  });

  describe('rates', () => {
    it.each(['developerRate', 'managerRate', 'testerRate'] as const)('%s', (name) => {
      const problems: [string, string][] = [
        ['', 'Rate is required'],
        ['3,100', 'Enter an amount like 7.20, with no commas or signs'],
        ['-1', 'Enter an amount like 7.20, with no commas or signs'],
        ['7.205', 'Enter an amount like 7.20, with no commas or signs'],
        ['100000.01', 'The rate must be 100,000.00 or less'],
        ['99999999999', 'Enter an amount like 7.20, with no commas or signs'],
      ];
      for (const [text, message] of problems) {
        const issues = issuesOf(form({ [name]: text }));
        expect([text, issues.map((issue) => issue.message)]).toEqual([text, [message]]);
        expect(issues[0].path).toEqual([name]);
      }
      for (const text of ['0', '0.00', '3100.00', '7.2', '100000', '100000.00', ' 50 ']) {
        expect([text, messagesOf(form({ [name]: text }))]).toEqual([text, []]);
      }
    });

    it('accepts a free tester', () => {
      expect(messagesOf(form({ testerRate: '0.00' }))).toEqual([]);
    });
  });

  describe('counts', () => {
    it.each(['developerCount', 'managerCount', 'testerCount'] as const)('%s', (name) => {
      const problems: [string, string][] = [
        ['', 'Count is required'],
        ['0', 'Count must be from 1 to 1,000'],
        ['1001', 'Count must be from 1 to 1,000'],
        ['1.5', 'Enter a whole number, like 3'],
        ['-1', 'Enter a whole number, like 3'],
      ];
      for (const [text, message] of problems) {
        const issues = issuesOf(form({ [name]: text }));
        expect([text, issues.map((issue) => issue.message)]).toEqual([text, [message]]);
        expect(issues[0].path).toEqual([name]);
      }
      for (const text of ['1', '3', '1000']) {
        expect([text, messagesOf(form({ [name]: text }))]).toEqual([text, []]);
      }
    });
  });

  describe('the length of a day and a month', () => {
    it.each([
      ['hoursPerDay', '', 'Hours per day is required'],
      ['hoursPerDay', '0', 'Hours per day must be from 1 to 24'],
      ['hoursPerDay', '25', 'Hours per day must be from 1 to 24'],
      ['hoursPerDay', '7.5', 'Enter a whole number, like 6'],
      ['hoursPerMonth', '', 'Hours per month is required'],
      ['hoursPerMonth', '0', 'Hours per month must be from 1 to 744'],
      ['hoursPerMonth', '745', 'Hours per month must be from 1 to 744'],
      ['hoursPerMonth', '160.5', 'Enter a whole number, like 160'],
    ] as const)('tells %s %j: %s', (name, text, message) => {
      const issues = issuesOf(form({ [name]: text }));
      expect(issues.map((issue) => issue.message)).toEqual([message]);
      expect(issues[0].path).toEqual([name]);
    });

    it.each([
      ['hoursPerDay', '1'],
      ['hoursPerDay', '24'],
      ['hoursPerMonth', '1'],
      ['hoursPerMonth', '744'],
    ] as const)('accepts %s %j', (name, text) => {
      expect(messagesOf(form({ [name]: text }))).toEqual([]);
    });
  });

  describe('currency', () => {
    it.each([
      ['', 'Currency is required'],
      ['RUPEE', 'Use a three-letter currency code, like INR'],
      ['IN', 'Use a three-letter currency code, like INR'],
      ['I1R', 'Use a three-letter currency code, like INR'],
      ['IN R', 'Use a three-letter currency code, like INR'],
    ])('tells %j: %s', (currencyCode, message) => {
      const issues = issuesOf(form({ currencyCode }));
      expect(issues.map((issue) => issue.message)).toEqual([message]);
      expect(issues[0].path).toEqual(['currencyCode']);
    });

    it.each(['INR', 'usd', ' eur '])('accepts %j', (currencyCode) => {
      expect(messagesOf(form({ currencyCode }))).toEqual([]);
    });
  });

  describe('a quote that is too large', () => {
    it('is refused once, on the lines, when 200 maximal lines are added up', () => {
      const issues = issuesOf(form({ lines: maximalLines() }));
      expect(issues.map((issue) => issue.message)).toEqual([TOO_LARGE]);
      expect(issues[0].path).toEqual(['lines']);
    });

    it('is still told once beside a wrong line, and not at all while a setting is wrong', () => {
      // The wrong line is left out of the sum, as it is on screen; the 199 others still come to too much.
      const wrongLine = issuesOf(form({ lines: [...maximalLines(199), line({ hoursPerUnit: '1,5' })] }));
      expect(wrongLine.map((issue) => issue.message)).toEqual([expect.stringContaining('Enter hours'), TOO_LARGE]);
      expect(wrongLine.map((issue) => issue.path)).toEqual([['lines', 199, 'hoursPerUnit'], ['lines']]);

      const wrongSetting = issuesOf(form({ developerRate: '3,100', lines: maximalLines() }));
      expect(wrongSetting.map((issue) => issue.message)).toEqual([
        'Enter an amount like 7.20, with no commas or signs',
      ]);
    });

    it('lets the workbook through', () => {
      expect(messagesOf(toQuoteFormValues(workbook))).toEqual([]);
    });

    it('also counts the rates: 10,000 hours are fine at the defaults and too much at the largest rates', () => {
      const lines = [line({ units: '100', hoursPerUnit: '100' })];
      expect(messagesOf(form({ lines }))).toEqual([]);
      expect(messagesOf(form({ lines, developerRate: '100000.00', managerRate: '100000.00' }))).toEqual([TOO_LARGE]);
    });
  });
});

describe('toCalcInput', () => {
  it('reads valid settings and lines into the mirror input', () => {
    const { settings, lines } = toCalcInput(toQuoteFormValues(rounding));
    expect(settings).toEqual({
      developerCount: 2,
      developerRateCents: 123_456,
      managerCount: 1,
      managerRateCents: 200_000,
      testerCount: 2,
      testerRateCents: 99_999,
      negotiationBufferBp: 750,
      managementBp: 1250,
      testingBp: 1000,
      bugFixBp: 500,
      hoursPerDay: 7,
      hoursPerMonth: 150,
    });
    expect(lines).toEqual([
      { units: 2, hoursHundredths: 750 },
      { units: 3, hoursHundredths: 25 },
      { units: 1, hoursHundredths: 1234 },
    ]);
  });

  it('has no settings while a percent is invalid, and the mirror is never asked for totals', () => {
    for (const text of ['abc', '', '100.01', '12.345', '-1']) {
      const { settings, lines } = toCalcInput(form({ managementPercent: text }));
      expect([text, settings]).toEqual([text, null]);
      expect(lines).toHaveLength(1);
    }
  });

  it.each([
    ['developerCount', '0'],
    ['managerCount', ''],
    ['testerCount', '1.5'],
    ['developerRate', '3,100'],
    ['testerRate', '-1'],
    ['hoursPerDay', '0'],
    ['hoursPerMonth', '745'],
    ['bugFixPercent', '1e1'],
    // The money is formatted in this currency, and a bad code would throw there.
    ['currencyCode', 'RUPEE'],
  ] as const)(
    'has no settings while %s is %j (a zero divisor or a fraction would throw in the mirror)',
    (name, text) => {
      expect(toCalcInput(form({ [name]: text })).settings).toBeNull();
    },
  );

  it('leaves a line with blank, invalid or out-of-range hours or units out, as if it were zero', () => {
    const { settings, lines } = toCalcInput(
      form({
        lines: [
          line({ units: '2', hoursPerUnit: '7.5' }),
          line({ hoursPerUnit: '' }),
          line({ hoursPerUnit: '1,5' }),
          line({ hoursPerUnit: '0' }),
          line({ hoursPerUnit: '10000.01' }),
          line({ units: '' }),
          line({ units: '1.5' }),
          line({ units: '0' }),
          line({ units: '100001' }),
          line({ units: '3', hoursPerUnit: '0.25' }),
        ],
      }),
    );
    expect(settings).not.toBeNull();
    expect(lines).toEqual([
      { units: 2, hoursHundredths: 750 },
      { units: 3, hoursHundredths: 25 },
    ]);
  });

  it('counts a line whose description is still blank, because only units and hours move the totals', () => {
    expect(toCalcInput(form({ lines: [line({ description: '' })] })).lines).toHaveLength(1);
  });

  it('gives the mirror what the saved totals say', () => {
    expect(totalsOf(toQuoteFormValues(workbook)).finalQuoteCents).toBe(571_725_000);
  });
});

describe('quoteTooLarge', () => {
  it('is true for 200 lines of 100,000 units at 10,000 hours', () => {
    expect(quoteTooLarge(form({ lines: maximalLines() }))).toBe(true);
  });

  it('is false for the workbook lines', () => {
    expect(quoteTooLarge(toQuoteFormValues(workbook))).toBe(false);
    expect(quoteTooLarge(toQuoteFormValues(rounding))).toBe(false);
  });

  it('is false for a quote with no valid lines', () => {
    expect(quoteTooLarge(form({ lines: [line({ hoursPerUnit: '' })] }))).toBe(false);
  });

  it('is false, without asking the mirror, while any setting is invalid', () => {
    for (const over of [
      { developerCount: '0' },
      { hoursPerDay: '0' },
      { hoursPerMonth: '' },
      { managementPercent: 'abc' },
      { developerRate: '3,100' },
      { currencyCode: 'RUPEE' },
    ]) {
      expect(() => quoteTooLarge(form({ ...over, lines: maximalLines() }))).not.toThrow();
      expect(quoteTooLarge(form({ ...over, lines: maximalLines() }))).toBe(false);
    }
  });

  it('is judged on the final quote against the largest amount, not on the hours', () => {
    // 10,000 hours come to 48,125,000.00 at the defaults (3,100.00 and a 25 % manager, plus the buffer) and to more than
    // 100,000,000.00 with the developers at the top rate.
    const lines = [line({ units: '100', hoursPerUnit: '100' })];
    expect(quoteTooLarge(form({ lines }))).toBe(false);
    expect(quoteTooLarge(form({ lines, developerRate: '100000.00' }))).toBe(true);
    expect(totalsOf(form({ lines })).finalQuoteCents).toBe(4_812_500_000);
  });
});
