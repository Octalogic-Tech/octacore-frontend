import { bufferedQuoteRow, quoteRows } from '@/test/fixtures/quotes';
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

type LineValues = QuoteFormValues['sections'][number]['lines'][number];

const line = (over: Partial<LineValues> = {}): LineValues => ({
  title: 'Home page',
  description: 'The hero, the services and the contact form',
  units: '1',
  hoursPerUnit: '16',
  ...over,
});

/** The given lines as the quote's one section. */
const section = (lines: LineValues[], title = 'Pages') => [{ title, lines }];

const form = (over: Partial<QuoteFormValues> = {}): QuoteFormValues => ({
  ...emptyQuoteForm,
  title: 'Storefront',
  sections: section([line()]),
  ...over,
});

/** Every line of a read quote, the sections' in order. */
const linesOf = (row: { sections: { lines: unknown[] }[] }) => row.sections.flatMap((entry) => entry.lines);

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
  it('reads the service rows, keeping the settings, the sections with their lines and the totals and dropping the rest', () => {
    expect(workbook).toMatchObject({
      id: 1,
      title: 'Acme storefront',
      currencyCode: 'INR',
      developerRateCents: 310_000,
      negotiationBufferPercent: 25,
      hoursPerMonth: 160,
    });
    expect(workbook.sections.map((entry) => [entry.id, entry.title, entry.lines.length])).toEqual([
      [1, 'Storefront', 30],
      [2, 'Back office', 23],
    ]);
    expect(linesOf(workbook)).toHaveLength(53);
    expect(workbook.sections[0].lines[0]).toEqual({
      id: 1,
      title: 'Workbook item 1',
      description: 'What workbook item 1 covers',
      units: 1,
      hoursPerUnit: 16,
    });
    expect(workbook.totals).toMatchObject({ baseHours: 1188, elapsedMonths: 2.48, finalQuoteCents: 571_725_000 });
    // The time buffer and the discount, and what they come to, are read too; the fixtures do not use them.
    expect(workbook).toMatchObject({ timeBufferPercent: 0, discountPercent: 0 });
    expect(workbook.totals).toMatchObject({ timeBufferHours: 0, bufferedBaseHours: 1188, discountCents: 0 });
    expect(rounding.negotiationBufferPercent).toBe(7.5);
    expect(rounding.sections[1].lines[0].hoursPerUnit).toBe(12.34);
    // There is no flat list of lines any more: only the sections hold them.
    expect(workbook).not.toHaveProperty('lines');
    expect(rounding.totals.personDays).toBe(5.19);
    // Audit columns are not read.
    expect(workbook).not.toHaveProperty('createdDate');
    expect(workbook).not.toHaveProperty('status');
    expect(workbook).toHaveProperty('updatedDate');
  });

  it('refuses a row whose totals or sections are missing or of the wrong type', () => {
    expect(quoteRowSchema.safeParse({ ...quoteRows[0], totals: undefined }).success).toBe(false);
    expect(quoteRowSchema.safeParse({ ...quoteRows[0], sections: undefined }).success).toBe(false);
    // The flat lines of before are not this service's row.
    const { sections: _sections, ...flat } = quoteRows[0];
    void _sections;
    expect(quoteRowSchema.safeParse({ ...flat, lines: linesOf(quoteRows[0]) }).success).toBe(false);
    // A line without its title is not a line of this service, nor a section without its id or title.
    const [firstSection, ...otherSections] = quoteRows[0].sections;
    const [first, ...rest] = firstSection.lines;
    const { title: _title, ...untitled } = first;
    void _title;
    expect(
      quoteRowSchema.safeParse({
        ...quoteRows[0],
        sections: [{ ...firstSection, lines: [untitled, ...rest] }, ...otherSections],
      }).success,
    ).toBe(false);
    const { id: _id, ...withoutId } = firstSection;
    const { title: _sectionTitle, ...withoutTitle } = firstSection;
    void [_id, _sectionTitle];
    expect(quoteRowSchema.safeParse({ ...quoteRows[0], sections: [withoutId] }).success).toBe(false);
    expect(quoteRowSchema.safeParse({ ...quoteRows[0], sections: [withoutTitle] }).success).toBe(false);
    expect(
      quoteRowSchema.safeParse({ ...quoteRows[0], totals: { ...quoteRows[0].totals, finalQuoteCents: '571725000' } })
        .success,
    ).toBe(false);
    expect(quoteRowSchema.safeParse({ ...quoteRows[0], developerRateCents: '310000' }).success).toBe(false);
    // The new settings and the new totals are part of the row: a service without them is not this one.
    const { timeBufferPercent: _timeBuffer, ...withoutTimeBuffer } = quoteRows[0];
    const { discountPercent: _discount, ...withoutDiscount } = quoteRows[0];
    void [_timeBuffer, _discount];
    expect(quoteRowSchema.safeParse(withoutTimeBuffer).success).toBe(false);
    expect(quoteRowSchema.safeParse(withoutDiscount).success).toBe(false);
    for (const field of ['timeBufferHours', 'bufferedBaseHours', 'discountCents'] as const) {
      const { [field]: _gone, ...totals } = quoteRows[0].totals;
      void _gone;
      expect([field, quoteRowSchema.safeParse({ ...quoteRows[0], totals }).success]).toEqual([field, false]);
    }
    expect(
      quoteRowSchema.safeParse({ ...quoteRows[0], totals: { ...quoteRows[0].totals, discountCents: 1.5 } }).success,
    ).toBe(false);
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

describe('a quote with a time buffer and a discount', () => {
  // The backend's third vector as the service would send it: a 12.5 % time buffer and a 7.5 % discount, a tie in each.
  const third = quoteRowSchema.parse(bufferedQuoteRow);

  it('reads the settings and the totals, and the mirror reproduces every total field', () => {
    expect(third).toMatchObject({ timeBufferPercent: 12.5, discountPercent: 7.5 });
    const mirror = totalsOf(toQuoteFormValues(third));
    for (const [name, value] of Object.entries(third.totals)) {
      const wire = name.endsWith('Cents') ? value : Math.round(value * 100);
      expect([name, mirror[name as keyof typeof mirror]]).toEqual([name, wire]);
    }
  });

  it('goes to the form as text and back to the body as the same numbers', () => {
    const values = toQuoteFormValues(third);
    expect(values).toMatchObject({ timeBufferPercent: '12.5', discountPercent: '7.5' });
    expect(messagesOf(values)).toEqual([]);
    expect(toQuoteBody(values)).toMatchObject({ timeBufferPercent: 12.5, discountPercent: 7.5 });
    expect(toQuoteFormValues({ ...third, timeBufferPercent: 100, discountPercent: 50 })).toMatchObject({
      timeBufferPercent: '100',
      discountPercent: '50',
    });
  });
});

describe('the new quote form', () => {
  it('starts from the defaults: INR, 3 developers at 3100.00, a manager at 3000.00, a free tester, no time buffer or discount, one General section with one blank line', () => {
    expect(emptyQuoteForm).toEqual({
      title: '',
      currencyCode: 'INR',
      developerCount: '3',
      developerRate: '3100.00',
      managerCount: '1',
      managerRate: '3000.00',
      testerCount: '1',
      testerRate: '0.00',
      timeBufferPercent: '0',
      negotiationBufferPercent: '25',
      discountPercent: '0',
      managementPercent: '25',
      testingPercent: '0',
      bugFixPercent: '0',
      hoursPerDay: '6',
      hoursPerMonth: '160',
      sections: [{ title: 'General', lines: [{ title: '', description: '', units: '1', hoursPerUnit: '' }] }],
    });
    expect(blankQuoteLine).toEqual({ title: '', description: '', units: '1', hoursPerUnit: '' });
  });

  it('opens a new quote on the defaults, with a section and a line of its own that editing cannot share', () => {
    const opened = toQuoteFormValues();
    expect(opened).toEqual(emptyQuoteForm);
    expect(opened.sections).not.toBe(emptyQuoteForm.sections);
    expect(opened.sections[0]).not.toBe(emptyQuoteForm.sections[0]);
    expect(opened.sections[0].lines).not.toBe(emptyQuoteForm.sections[0].lines);
    expect(opened.sections[0].lines[0]).not.toBe(emptyQuoteForm.sections[0].lines[0]);
    expect(opened.sections[0].lines[0]).not.toBe(blankQuoteLine);
  });

  it('lists every setting, and neither the title nor the sections, so the editor can tell the drawer from the table', () => {
    expect([...SETTINGS_FIELDS].sort()).toEqual(
      Object.keys(emptyQuoteForm)
        .filter((name) => name !== 'title' && name !== 'sections')
        .sort(),
    );
    expect(SETTINGS_FIELDS).toContain('currencyCode');
    expect(SETTINGS_FIELDS).toContain('testerRate');
    expect(SETTINGS_FIELDS).toContain('timeBufferPercent');
    expect(SETTINGS_FIELDS).toContain('discountPercent');
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
        timeBufferPercent: ' 12.5 ',
        negotiationBufferPercent: '7.5',
        discountPercent: '10',
        managementPercent: ' 25 ',
        sections: [
          {
            title: '  Pages ',
            lines: [
              line({ title: '  Home page ', description: ' The hero  ', units: ' 2 ', hoursPerUnit: ' 7.5 ' }),
              line({ title: 'Contact', description: ' \n  ', units: '1', hoursPerUnit: '3' }),
            ],
          },
          { title: 'Later', lines: [] },
        ],
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
      timeBufferPercent: 12.5,
      negotiationBufferPercent: 7.5,
      discountPercent: 10,
      managementPercent: 25,
      testingPercent: 0,
      bugFixPercent: 0,
      hoursPerDay: 6,
      hoursPerMonth: 160,
      // Section and line titles trimmed, a blank description sent as empty text, a section without lines kept.
      sections: [
        {
          title: 'Pages',
          lines: [
            { title: 'Home page', description: 'The hero', units: 2, hoursPerUnit: 7.5 },
            { title: 'Contact', description: '', units: 1, hoursPerUnit: 3 },
          ],
        },
        { title: 'Later', lines: [] },
      ],
    });
    expect(body).not.toHaveProperty('lines');
    // The title goes first on the wire, as the service lists a section's and a line's fields.
    expect(Object.keys(body.sections[0])).toEqual(['title', 'lines']);
    expect(Object.keys(body.sections[0].lines[0])).toEqual(['title', 'description', 'units', 'hoursPerUnit']);
  });

  it('is the fixture row, its sections in order, once the row is made into form values and back', () => {
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
        timeBufferPercent: row.timeBufferPercent,
        negotiationBufferPercent: row.negotiationBufferPercent,
        discountPercent: row.discountPercent,
        managementPercent: row.managementPercent,
        testingPercent: row.testingPercent,
        bugFixPercent: row.bugFixPercent,
        hoursPerDay: row.hoursPerDay,
        hoursPerMonth: row.hoursPerMonth,
        sections: row.sections.map((entry) => ({
          title: entry.title,
          lines: entry.lines.map(({ title, description, units, hoursPerUnit }) => ({ title, description, units, hoursPerUnit })),
        })),
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
      timeBufferPercent: '0',
      negotiationBufferPercent: '25',
      discountPercent: '0',
      hoursPerMonth: '160',
    });
    expect(toQuoteFormValues(workbook).sections.map((entry) => [entry.title, entry.lines.length])).toEqual([
      ['Storefront', 30],
      ['Back office', 23],
    ]);
    expect(toQuoteFormValues(workbook).sections[0].lines[0]).toEqual({
      title: 'Workbook item 1',
      description: 'What workbook item 1 covers',
      units: '1',
      hoursPerUnit: '16',
    });
    expect(toQuoteFormValues(rounding)).toMatchObject({
      developerRate: '1234.56',
      testerRate: '999.99',
      negotiationBufferPercent: '7.5',
      managementPercent: '12.5',
    });
    expect(
      toQuoteFormValues(rounding).sections.map((entry) => [entry.title, entry.lines.map((item) => item.hoursPerUnit)]),
    ).toEqual([
      ['Screens', ['7.5', '0.25']],
      ['Reports', ['12.34']],
    ]);
  });

  it('gives a saved quote that somehow has no sections a General one with one blank line to type into', () => {
    expect(toQuoteFormValues({ ...workbook, sections: [] }).sections).toEqual([{ title: 'General', lines: [blankQuoteLine] }]);
  });

  it('keeps a saved section without lines as it is', () => {
    const values = toQuoteFormValues({ ...rounding, sections: [...rounding.sections, { id: 99, title: 'Later', lines: [] }] });
    expect(values.sections.map((entry) => [entry.title, entry.lines.length])).toEqual([
      ['Screens', 2],
      ['Reports', 1],
      ['Later', 0],
    ]);
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

  it('asks for a line in the whole quote, and allows no more than 200 over all the sections', () => {
    const lines = (count: number) => Array.from({ length: count }, () => line({ hoursPerUnit: '1' }));
    const empty = issuesOf(form({ sections: section([]) }));
    expect(empty.map((issue) => [issue.path, issue.message])).toEqual([[['sections'], 'Add at least one line']]);
    expect(messagesOf(form({ sections: [...section([]), ...section([]), ...section([])] }))).toEqual([
      'Add at least one line',
    ]);
    // A section may be empty while another has the line.
    expect(messagesOf(form({ sections: [...section([]), ...section(lines(1))] }))).toEqual([]);
    expect(messagesOf(form({ sections: section(lines(200)) }))).toEqual([]);
    expect(messagesOf(form({ sections: [...section(lines(100)), ...section(lines(100))] }))).toEqual([]);
    const over = issuesOf(form({ sections: [...section(lines(150)), ...section(lines(51))] }));
    expect(over.map((issue) => [issue.path, issue.message])).toEqual([[['sections'], 'A quote has at most 200 lines']]);
    // One section of 201 is told on the section and on the quote.
    expect(messagesOf(form({ sections: section(lines(201)) }))).toEqual([
      'A section has at most 200 lines',
      'A quote has at most 200 lines',
    ]);
  });

  it('asks for from 1 to 50 sections', () => {
    expect(messagesOf(form({ sections: [] }))).toEqual(['Add at least one section']);
    const sections = (count: number) =>
      Array.from({ length: count }, (_unused, index) => ({ title: `Part ${index + 1}`, lines: index === 0 ? [line()] : [] }));
    expect(messagesOf(form({ sections: sections(50) }))).toEqual([]);
    const over = issuesOf(form({ sections: sections(51) }));
    expect(over.map((issue) => [issue.path, issue.message])).toEqual([[['sections'], 'A quote has at most 50 sections']]);
  });

  it('asks for a title on a section, a blank one or one of spaces alike', () => {
    for (const title of ['', '   ']) {
      const issues = issuesOf(form({ sections: [...section([line()]), { title, lines: [] }] }));
      expect(issues.map((issue) => [issue.path, issue.message])).toEqual([
        [['sections', 1, 'title'], 'Section title is required'],
      ]);
    }
  });

  it('takes a line without a description: it is optional, any text or none', () => {
    for (const description of ['', ' ', '\n', 'Anything at all']) {
      expect([description, messagesOf(form({ sections: section([line({ description })]) }))]).toEqual([description, []]);
    }
  });

  it('asks for a title on a line, a blank one or one of spaces alike', () => {
    for (const title of ['', '   ']) {
      const issues = issuesOf(form({ sections: section([line(), line({ title })]) }));
      expect(issues.map((issue) => issue.message)).toEqual(['Title is required']);
      expect(issues[0].path).toEqual(['sections', 0, 'lines', 1, 'title']);
    }
  });

  it('tells a line with neither a title nor a description only of its title', () => {
    const issues = issuesOf(form({ sections: [...section([line()]), ...section([line(), line({ title: '', description: '' })])] }));
    expect(issues.map((issue) => [issue.path, issue.message])).toEqual([
      [['sections', 1, 'lines', 1, 'title'], 'Title is required'],
    ]);
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
      const issues = issuesOf(form({ sections: section([line({ units })]) }));
      expect(issues.map((issue) => issue.message)).toEqual([message]);
      expect(issues[0].path).toEqual(['sections', 0, 'lines', 0, 'units']);
    });

    it.each(['1', '100000', ' 7 '])('accepts %j', (units) => {
      // At a hundredth of an hour each, so the quote itself is not too large.
      expect(messagesOf(form({ sections: section([line({ units, hoursPerUnit: '0.01' })]) }))).toEqual([]);
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
      const issues = issuesOf(form({ sections: section([line({ hoursPerUnit })]) }));
      expect(issues.map((issue) => issue.message)).toEqual([message]);
      expect(issues[0].path).toEqual(['sections', 0, 'lines', 0, 'hoursPerUnit']);
    });

    it.each(['0.5', '0.01', '16', '7.5', '12.34', '10000', '10000.00', ' 8 '])('accepts %j', (hoursPerUnit) => {
      expect(messagesOf(form({ sections: section([line({ hoursPerUnit })]) }))).toEqual([]);
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

  describe('the time buffer', () => {
    it.each([
      ['', 'Percentage is required'],
      ['100.01', 'Percentage must be from 0 to 100'],
      ['101', 'Percentage must be from 0 to 100'],
      ['-1', 'Enter a percentage like 7.5'],
      ['12.345', 'Enter a percentage like 7.5'],
      ['1,5', 'Enter a percentage like 7.5'],
      ['abc', 'Enter a percentage like 7.5'],
    ])('tells %j: %s', (text, message) => {
      const issues = issuesOf(form({ timeBufferPercent: text }));
      expect(issues.map((issue) => issue.message)).toEqual([message]);
      expect(issues[0].path).toEqual(['timeBufferPercent']);
    });

    it.each(['0', '0.00', '12.5', '12.25', '100', '100.00', ' 10 '])('accepts %j', (text) => {
      expect(messagesOf(form({ timeBufferPercent: text }))).toEqual([]);
    });
  });

  describe('the discount', () => {
    it.each([
      ['', 'Percentage is required'],
      ['50.01', 'Discount must be from 0 to 50'],
      ['51', 'Discount must be from 0 to 50'],
      ['100', 'Discount must be from 0 to 50'],
      ['-1', 'Enter a percentage like 7.5'],
      ['12.345', 'Enter a percentage like 7.5'],
      ['7,5', 'Enter a percentage like 7.5'],
      ['abc', 'Enter a percentage like 7.5'],
    ])('tells %j: %s', (text, message) => {
      const issues = issuesOf(form({ discountPercent: text }));
      expect(issues.map((issue) => issue.message)).toEqual([message]);
      expect(issues[0].path).toEqual(['discountPercent']);
    });

    it.each(['0', '0.00', '7.5', '10', '49.99', '50', '50.00', ' 12.25 '])('accepts %j', (text) => {
      expect(messagesOf(form({ discountPercent: text }))).toEqual([]);
    });
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
    it('is refused once, on the sections, when 200 maximal lines are added up', () => {
      const issues = issuesOf(form({ sections: section(maximalLines()) }));
      expect(issues.map((issue) => issue.message)).toEqual([TOO_LARGE]);
      expect(issues[0].path).toEqual(['sections']);
      // Over several sections alike.
      const split = issuesOf(form({ sections: [...section(maximalLines(100)), ...section(maximalLines(100))] }));
      expect(split.map((issue) => [issue.path, issue.message])).toEqual([[['sections'], TOO_LARGE]]);
    });

    it('is still told once beside a wrong line, and not at all while a setting is wrong', () => {
      // The wrong line is left out of the sum, as it is on screen; the 199 others still come to too much.
      const wrongLine = issuesOf(form({ sections: section([...maximalLines(199), line({ hoursPerUnit: '1,5' })]) }));
      expect(wrongLine.map((issue) => issue.message)).toEqual([expect.stringContaining('Enter hours'), TOO_LARGE]);
      expect(wrongLine.map((issue) => issue.path)).toEqual([['sections', 0, 'lines', 199, 'hoursPerUnit'], ['sections']]);

      const wrongSetting = issuesOf(form({ developerRate: '3,100', sections: section(maximalLines()) }));
      expect(wrongSetting.map((issue) => issue.message)).toEqual([
        'Enter an amount like 7.20, with no commas or signs',
      ]);
    });

    it('lets the workbook through', () => {
      expect(messagesOf(toQuoteFormValues(workbook))).toEqual([]);
    });

    it('also counts the rates: 10,000 hours are fine at the defaults and too much at the largest rates', () => {
      const sections = section([line({ units: '100', hoursPerUnit: '100' })]);
      expect(messagesOf(form({ sections }))).toEqual([]);
      expect(messagesOf(form({ sections, developerRate: '100000.00', managerRate: '100000.00' }))).toEqual([TOO_LARGE]);
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
      timeBufferBp: 0,
      discountBp: 0,
    });
    expect(lines).toEqual([
      { units: 2, hoursHundredths: 750 },
      { units: 3, hoursHundredths: 25 },
      { units: 1, hoursHundredths: 1234 },
    ]);
  });

  it('reads the time buffer and the discount in hundredths of a percent', () => {
    const { settings } = toCalcInput(form({ timeBufferPercent: '12.5', discountPercent: ' 7.25 ' }));
    expect(settings).toMatchObject({ timeBufferBp: 1250, discountBp: 725 });
    expect(toCalcInput(form({ timeBufferPercent: '100', discountPercent: '50' })).settings).toMatchObject({
      timeBufferBp: 10_000,
      discountBp: 5000,
    });
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
    ['timeBufferPercent', '100.01'],
    ['timeBufferPercent', ''],
    ['discountPercent', '50.01'],
    ['discountPercent', 'abc'],
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
        sections: section([
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
        ]),
      }),
    );
    expect(settings).not.toBeNull();
    expect(lines).toEqual([
      { units: 2, hoursHundredths: 750 },
      { units: 3, hoursHundredths: 25 },
    ]);
  });

  it('counts a line whose title or description is still blank, because only units and hours move the totals', () => {
    expect(toCalcInput(form({ sections: section([line({ title: '', description: '' })]) })).lines).toHaveLength(1);
  });

  it('takes the valid lines of every section, in order, and an empty section adds nothing', () => {
    const { lines } = toCalcInput(
      form({
        sections: [
          ...section([line({ units: '2', hoursPerUnit: '7.5' }), line({ hoursPerUnit: '' })]),
          ...section([]),
          ...section([line({ units: '3', hoursPerUnit: '0.25' }), line({ hoursPerUnit: '12.34' })], 'Later'),
        ],
      }),
    );
    expect(lines).toEqual([
      { units: 2, hoursHundredths: 750 },
      { units: 3, hoursHundredths: 25 },
      { units: 1, hoursHundredths: 1234 },
    ]);
  });

  it('comes to the same totals for the same lines in one section or split over three', () => {
    const lines = [
      line({ units: '1', hoursPerUnit: '10.12' }),
      line({ units: '3', hoursPerUnit: '2.5' }),
      line({ units: '2', hoursPerUnit: '7.25' }),
      line({ units: '1', hoursPerUnit: '0.2' }),
    ];
    const settings = { timeBufferPercent: '12.5', discountPercent: '7.5' };
    const one = totalsOf(form({ ...settings, sections: section(lines) }));
    const three = totalsOf(
      form({
        ...settings,
        sections: [...section(lines.slice(0, 1)), ...section(lines.slice(1, 3), 'B'), ...section(lines.slice(3), 'C')],
      }),
    );
    expect(three).toEqual(one);
    expect(one.bufferedBaseHours).toBe(3637);
  });

  it('gives the mirror what the saved totals say', () => {
    expect(totalsOf(toQuoteFormValues(workbook)).finalQuoteCents).toBe(571_725_000);
  });
});

describe('quoteTooLarge', () => {
  it('is true for 200 lines of 100,000 units at 10,000 hours', () => {
    expect(quoteTooLarge(form({ sections: section(maximalLines()) }))).toBe(true);
  });

  it('is false for the workbook lines', () => {
    expect(quoteTooLarge(toQuoteFormValues(workbook))).toBe(false);
    expect(quoteTooLarge(toQuoteFormValues(rounding))).toBe(false);
  });

  it('is false for a quote with no valid lines', () => {
    expect(quoteTooLarge(form({ sections: section([line({ hoursPerUnit: '' })]) }))).toBe(false);
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
      expect(() => quoteTooLarge(form({ ...over, sections: section(maximalLines()) }))).not.toThrow();
      expect(quoteTooLarge(form({ ...over, sections: section(maximalLines()) }))).toBe(false);
    }
  });

  it('is judged on the final quote against the largest amount, not on the hours', () => {
    // 10,000 hours come to 48,125,000.00 at the defaults (3,100.00 and a 25 % manager, plus the buffer) and to more than
    // 100,000,000.00 with the developers at the top rate.
    const sections = section([line({ units: '100', hoursPerUnit: '100' })]);
    expect(quoteTooLarge(form({ sections }))).toBe(false);
    expect(quoteTooLarge(form({ sections, developerRate: '100000.00' }))).toBe(true);
    expect(totalsOf(form({ sections })).finalQuoteCents).toBe(4_812_500_000);
  });

  it('counts the time buffer, which pads the price, and the discount, which comes off the final quote', () => {
    // 10,500 hours come to 50,531,250.00 at the defaults; a 100 % time buffer doubles the hours and the quote to
    // 101,062,500.00, and a 10 % discount brings that back to 90,956,250.00.
    const sections = section([line({ units: '100', hoursPerUnit: '105' })]);
    expect(quoteTooLarge(form({ sections }))).toBe(false);
    expect(quoteTooLarge(form({ sections, timeBufferPercent: '100' }))).toBe(true);
    expect(totalsOf(form({ sections, timeBufferPercent: '100' })).finalQuoteCents).toBe(10_106_250_000);
    expect(quoteTooLarge(form({ sections, timeBufferPercent: '100', discountPercent: '10' }))).toBe(false);
    const discounted = form({ sections, timeBufferPercent: '100', discountPercent: '10' });
    expect(totalsOf(discounted).finalQuoteCents).toBe(9_095_625_000);
    expect(messagesOf(form({ sections, timeBufferPercent: '100' }))).toEqual([TOO_LARGE]);
    expect(messagesOf(form({ sections, timeBufferPercent: '100', discountPercent: '10' }))).toEqual([]);
  });
});
