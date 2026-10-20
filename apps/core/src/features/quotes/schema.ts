import { z } from 'zod';
import { MAX_CENTS, amountProblem, parseAmount, toAmountText } from '@/lib/money';
import { hundredthsOf, quoteTotals, type CalcLine, type CalcSettings } from './calc';

// The limits of the service (`app/core/quoting.py`), so the form refuses what it would answer with a 422.
export const MAX_LINES = 200;
export const MAX_SECTIONS = 50;
const MAX_UNITS = 100_000;
const MAX_HOURS_HUNDREDTHS = 1_000_000; // 10,000 hours
const MAX_COUNT = 1_000;
const MAX_RATE_CENTS = 10_000_000; // 100,000.00 an hour
const MAX_PERCENT_HUNDREDTHS = 10_000; // 100 %
const MAX_DISCOUNT_HUNDREDTHS = 5_000; // 50 %, the invoices' own cap
const MAX_HOURS_PER_DAY = 24;
const MAX_HOURS_PER_MONTH = 744;

const WHOLE_NUMBER = /^\d+$/;
// Hours and percentages alike: digits and up to two decimals, as typed ("7.5", "12.25"). A leading dot, a comma, a sign, an
// exponent or a third decimal is told what is wrong, not dropped or read as something else.
const HUNDREDTHS_TEXT = /^\d+(\.\d{1,2})?$/;
const CURRENCY_TEXT = /^[A-Za-z]{3}$/;

const TOO_LARGE = 'The quote comes to more than 100,000,000.00. Reduce the hours or the rates.';

// What each field's text can be told, as a message or null. Plain functions, so the editor can also ask them on every
// keystroke (`toCalcInput`) without building a zod parse for each of up to 200 lines.

/** A whole number from `min` to `max`, with the messages of the field it is for. */
function wholeNumberProblem(options: { required: string; example: number; range: string; min: number; max: number }) {
  return (text: string): string | null => {
    if (text === '') return options.required;
    if (!WHOLE_NUMBER.test(text)) return `Enter a whole number, like ${options.example}`;
    const value = Number(text);
    return value < options.min || value > options.max ? options.range : null;
  };
}

const countProblem = wholeNumberProblem({
  required: 'Count is required',
  example: 3,
  min: 1,
  max: MAX_COUNT,
  range: 'Count must be from 1 to 1,000',
});

const unitsProblem = wholeNumberProblem({
  required: 'Units are required',
  example: 3,
  min: 1,
  max: MAX_UNITS,
  range: 'Units must be from 1 to 100,000',
});

const hoursPerDayProblem = wholeNumberProblem({
  required: 'Hours per day is required',
  example: 6,
  min: 1,
  max: MAX_HOURS_PER_DAY,
  range: 'Hours per day must be from 1 to 24',
});

const hoursPerMonthProblem = wholeNumberProblem({
  required: 'Hours per month is required',
  example: 160,
  min: 1,
  max: MAX_HOURS_PER_MONTH,
  range: 'Hours per month must be from 1 to 744',
});

/** Hours per unit: more than 0 and at most 10,000, to the hundredth. */
function hoursProblem(text: string): string | null {
  if (text === '') return 'Hours are required';
  if (!HUNDREDTHS_TEXT.test(text)) return 'Enter hours like 7.5, with up to two decimals and no commas or signs';
  const hundredths = hundredthsOf(text);
  if (hundredths < 1) return 'Hours must be more than 0';
  return hundredths > MAX_HOURS_HUNDREDTHS ? 'Hours must be 10,000 or less' : null;
}

/** A percentage from 0 up to `max` (in hundredths of a percent), to the hundredth, with the message for one above it. */
function percentRule(max: number, tooLarge: string) {
  return (text: string): string | null => {
    if (text === '') return 'Percentage is required';
    if (!HUNDREDTHS_TEXT.test(text)) return 'Enter a percentage like 7.5';
    return hundredthsOf(text) > max ? tooLarge : null;
  };
}

/** A percentage from 0 to 100: the time buffer, the negotiation buffer, management, testing and bug fixing. */
const percentProblem = percentRule(MAX_PERCENT_HUNDREDTHS, 'Percentage must be from 0 to 100');

/** The discount, from 0 to 50 %: no more than an invoice may take off, so a quote can become an invoice. */
const discountProblem = percentRule(MAX_DISCOUNT_HUNDREDTHS, 'Discount must be from 0 to 50');

/** An hourly rate in units and hundredths of the quote's currency: 0 is a fair rate (a tester may be free). */
function rateProblem(text: string): string | null {
  if (text === '') return 'Rate is required';
  const problem = amountProblem(text, { allowZero: true });
  if (problem !== null) return problem;
  return parseAmount(text) > MAX_RATE_CENTS ? 'The rate must be 100,000.00 or less' : null;
}

function currencyProblem(text: string): string | null {
  if (text === '') return 'Currency is required';
  return CURRENCY_TEXT.test(text) ? null : 'Use a three-letter currency code, like INR';
}

// Text, not number inputs: a comma or a sign must be told what is wrong, not dropped.
function textField(problem: (text: string) => string | null) {
  return z
    .string()
    .trim()
    .superRefine((text, context) => {
      const message = problem(text);
      if (message !== null) context.addIssue({ code: 'custom', message });
    });
}

const quoteLineRowSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  description: z.string(),
  units: z.number().int(),
  hoursPerUnit: z.number(),
});

const quoteSectionRowSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  lines: z.array(quoteLineRowSchema),
});

// Hours, person-days and months are decimal numbers on the wire (1188, 2.48); every cost is whole minor units.
const quoteTotalsRowSchema = z.object({
  baseHours: z.number(),
  timeBufferHours: z.number(),
  bufferedBaseHours: z.number(),
  testingHours: z.number(),
  bugFixHours: z.number(),
  developmentHours: z.number(),
  buildHours: z.number(),
  managementHours: z.number(),
  totalHours: z.number(),
  developmentHoursPerPerson: z.number(),
  managementHoursPerPerson: z.number(),
  testingHoursPerPerson: z.number(),
  personDays: z.number(),
  elapsedMonths: z.number(),
  developmentCostCents: z.number().int(),
  managementCostCents: z.number().int(),
  testingCostCents: z.number().int(),
  subtotalCents: z.number().int(),
  negotiationBufferCents: z.number().int(),
  discountCents: z.number().int(),
  finalQuoteCents: z.number().int(),
});

// Only what the pages use; the audit columns and anything the service adds later are dropped.
export const quoteRowSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  currencyCode: z.string(),
  developerCount: z.number().int(),
  developerRateCents: z.number().int(),
  managerCount: z.number().int(),
  managerRateCents: z.number().int(),
  testerCount: z.number().int(),
  testerRateCents: z.number().int(),
  // Percents are JSON numbers with up to two decimals (25, 7.5).
  timeBufferPercent: z.number(),
  negotiationBufferPercent: z.number(),
  discountPercent: z.number(),
  managementPercent: z.number(),
  testingPercent: z.number(),
  bugFixPercent: z.number(),
  hoursPerDay: z.number().int(),
  hoursPerMonth: z.number().int(),
  updatedDate: z.string(),
  // In the order written; the lines of every section make up the quote.
  sections: z.array(quoteSectionRowSchema),
  totals: quoteTotalsRowSchema,
});

export const quoteRowsSchema = z.array(quoteRowSchema);

export type QuoteRow = z.output<typeof quoteRowSchema>;

// Every field is text, so a blank field can be told from a typed one. The settings are in the form with the sections, so a
// drawer that closes keeps what was typed and one save stores it all.
const settingsShape = {
  currencyCode: textField(currencyProblem),
  developerCount: textField(countProblem),
  developerRate: textField(rateProblem),
  managerCount: textField(countProblem),
  managerRate: textField(rateProblem),
  testerCount: textField(countProblem),
  testerRate: textField(rateProblem),
  timeBufferPercent: textField(percentProblem),
  negotiationBufferPercent: textField(percentProblem),
  discountPercent: textField(discountProblem),
  managementPercent: textField(percentProblem),
  testingPercent: textField(percentProblem),
  bugFixPercent: textField(percentProblem),
  hoursPerDay: textField(hoursPerDayProblem),
  hoursPerMonth: textField(hoursPerMonthProblem),
};

const settingsSchema = z.object(settingsShape);

// A line's title is its short name ("Login (JWT)"); the description, behind a button, says what it covers and may be
// left empty.
const quoteLineSchema = z.object({
  // The editor's own handle on the line (see `uids.ts`): it keeps the line's place in the page while it is dragged. Never
  // sent: `toQuoteBody` names what is.
  uid: z.string().optional(),
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string(),
  units: textField(unitsProblem),
  hoursPerUnit: textField(hoursProblem),
});

// A section only groups lines. It may be empty while the quote is being built; the quote as a whole needs a line.
const quoteSectionSchema = z.object({
  uid: z.string().optional(),
  title: z.string().trim().min(1, 'Section title is required'),
  // At most 200 lines, told in the quote's own check below, beside the count for the whole quote.
  lines: z.array(quoteLineSchema),
});

export const quoteFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required'),
    ...settingsShape,
    sections: z
      .array(quoteSectionSchema)
      .min(1, 'Add at least one section')
      .max(MAX_SECTIONS, `A quote has at most ${MAX_SECTIONS} sections`),
  })
  .superRefine((values, context) => {
    // The count of lines and the size of the quote are the quote's, not one section's: said once, on the sections.
    values.sections.forEach((section, index) => {
      if (section.lines.length > MAX_LINES) {
        const message = `A section has at most ${MAX_LINES} lines`;
        context.addIssue({ code: 'custom', path: ['sections', index, 'lines'], message });
      }
    });
    const count = lineCount(values);
    // With no section at all, that is what is said.
    if (count === 0 && values.sections.length > 0) {
      context.addIssue({ code: 'custom', path: ['sections'], message: 'Add at least one line' });
    }
    if (count > MAX_LINES) {
      context.addIssue({ code: 'custom', path: ['sections'], message: `A quote has at most ${MAX_LINES} lines` });
    }
    // Each field can be in range while the quote is not: the service refuses a final quote above the largest amount. Said
    // once (the lines are what to reduce, with the rates), and only while the settings are valid.
    if (quoteTooLarge(values)) context.addIssue({ code: 'custom', path: ['sections'], message: TOO_LARGE });
  });

export type QuoteFormValues = z.infer<typeof quoteFormSchema>;
export type SectionFormValues = QuoteFormValues['sections'][number];
export type LineFormValues = SectionFormValues['lines'][number];

/** Every field the settings drawer holds: all but the title and the sections. */
export const SETTINGS_FIELDS = Object.keys(settingsShape) as readonly (keyof QuoteFormValues)[];

export const blankQuoteLine: LineFormValues = {
  title: '',
  description: '',
  units: '1',
  hoursPerUnit: '',
};

/** The first section of a new quote. */
export const FIRST_SECTION_TITLE = 'General';

/** How many lines the quote has, over all its sections. */
export function lineCount(values: Pick<QuoteFormValues, 'sections'>): number {
  return values.sections.reduce((sum, section) => sum + section.lines.length, 0);
}

/** A line's units x hours per unit, in hundredths of an hour, or null while either is blank or invalid. */
export function lineHours(line: LineFormValues | undefined): number | null {
  if (line === undefined) return null;
  const units = line.units.trim();
  const hours = line.hoursPerUnit.trim();
  return unitsProblem(units) === null && hoursProblem(hours) === null ? Number(units) * hundredthsOf(hours) : null;
}

export const emptyQuoteForm: QuoteFormValues = {
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
  sections: [{ title: FIRST_SECTION_TITLE, lines: [{ ...blankQuoteLine }] }],
};

export function toQuoteFormValues(row?: QuoteRow): QuoteFormValues {
  const firstSection = () => [{ title: FIRST_SECTION_TITLE, lines: [{ ...blankQuoteLine }] }];
  if (!row) return { ...emptyQuoteForm, sections: firstSection() };
  return {
    title: row.title,
    currencyCode: row.currencyCode,
    developerCount: String(row.developerCount),
    developerRate: toAmountText(row.developerRateCents),
    managerCount: String(row.managerCount),
    managerRate: toAmountText(row.managerRateCents),
    testerCount: String(row.testerCount),
    testerRate: toAmountText(row.testerRateCents),
    timeBufferPercent: String(row.timeBufferPercent),
    negotiationBufferPercent: String(row.negotiationBufferPercent),
    discountPercent: String(row.discountPercent),
    managementPercent: String(row.managementPercent),
    testingPercent: String(row.testingPercent),
    bugFixPercent: String(row.bugFixPercent),
    hoursPerDay: String(row.hoursPerDay),
    hoursPerMonth: String(row.hoursPerMonth),
    sections:
      row.sections.length > 0
        ? row.sections.map((section) => ({
            title: section.title,
            lines: section.lines.map((line) => ({
              title: line.title,
              description: line.description,
              units: String(line.units),
              hoursPerUnit: String(line.hoursPerUnit),
            })),
          }))
        : firstSection(),
  };
}

export interface QuoteLineBody {
  title: string;
  /** Empty text when the line has none. */
  description: string;
  units: number;
  hoursPerUnit: number;
}

export interface QuoteSectionBody {
  title: string;
  lines: QuoteLineBody[];
}

export interface QuoteBody {
  title: string;
  currencyCode: string;
  developerCount: number;
  /** Whole minor units of the quote's currency; the form holds units and hundredths. */
  developerRateCents: number;
  managerCount: number;
  managerRateCents: number;
  testerCount: number;
  testerRateCents: number;
  timeBufferPercent: number;
  negotiationBufferPercent: number;
  discountPercent: number;
  managementPercent: number;
  testingPercent: number;
  bugFixPercent: number;
  hoursPerDay: number;
  hoursPerMonth: number;
  /** The whole set: the service replaces the quote's sections and their lines with these. */
  sections: QuoteSectionBody[];
}

/** The form as a create or update body. Call it once `quoteFormSchema` has accepted the values. */
export function toQuoteBody(values: QuoteFormValues): QuoteBody {
  const number = (text: string) => Number(text.trim());
  return {
    title: values.title.trim(),
    currencyCode: values.currencyCode.trim().toUpperCase(),
    developerCount: number(values.developerCount),
    developerRateCents: parseAmount(values.developerRate),
    managerCount: number(values.managerCount),
    managerRateCents: parseAmount(values.managerRate),
    testerCount: number(values.testerCount),
    testerRateCents: parseAmount(values.testerRate),
    timeBufferPercent: number(values.timeBufferPercent),
    negotiationBufferPercent: number(values.negotiationBufferPercent),
    discountPercent: number(values.discountPercent),
    managementPercent: number(values.managementPercent),
    testingPercent: number(values.testingPercent),
    bugFixPercent: number(values.bugFixPercent),
    hoursPerDay: number(values.hoursPerDay),
    hoursPerMonth: number(values.hoursPerMonth),
    sections: values.sections.map((section) => ({
      title: section.title.trim(),
      lines: section.lines.map((line) => ({
        title: line.title.trim(),
        // Blank or spaces alike are sent as empty text.
        description: line.description.trim(),
        units: number(line.units),
        hoursPerUnit: number(line.hoursPerUnit),
      })),
    })),
  };
}

/**
 * What the totals are calculated from, as the form stands. `settings` is null while any settings field is invalid: the
 * mirror throws on a zero count, day or month and on a fraction, and the money is formatted in the currency, so a blank
 * or wrong setting means no totals, never a wrong or broken one. The lines are those of every section, in order; a line
 * whose units or hours are invalid is left out, as if they were zero.
 */
export function toCalcInput(values: QuoteFormValues): { settings: CalcSettings | null; lines: CalcLine[] } {
  const lines = values.sections.flatMap((section) =>
    section.lines.flatMap((line) =>
      lineHours(line) === null
        ? []
        : [{ units: Number(line.units.trim()), hoursHundredths: hundredthsOf(line.hoursPerUnit.trim()) }],
    ),
  );
  if (!settingsSchema.safeParse(values).success) return { settings: null, lines };

  const whole = (text: string) => Number(text.trim());
  const percent = (text: string) => hundredthsOf(text.trim());
  return {
    settings: {
      developerCount: whole(values.developerCount),
      developerRateCents: parseAmount(values.developerRate),
      managerCount: whole(values.managerCount),
      managerRateCents: parseAmount(values.managerRate),
      testerCount: whole(values.testerCount),
      testerRateCents: parseAmount(values.testerRate),
      negotiationBufferBp: percent(values.negotiationBufferPercent),
      managementBp: percent(values.managementPercent),
      testingBp: percent(values.testingPercent),
      bugFixBp: percent(values.bugFixPercent),
      hoursPerDay: whole(values.hoursPerDay),
      hoursPerMonth: whole(values.hoursPerMonth),
      timeBufferBp: percent(values.timeBufferPercent),
      discountBp: percent(values.discountPercent),
    },
    lines,
  };
}

/** Whether the final quote is above the largest amount the service accepts. False while the settings are invalid. */
export function quoteTooLarge(values: QuoteFormValues): boolean {
  const { settings, lines } = toCalcInput(values);
  return settings !== null && quoteTotals(settings, lines).finalQuoteCents > MAX_CENTS;
}
