import { z } from 'zod';
import { MAX_CENTS, amountProblem, parseAmount, toAmountText } from '@/lib/money';
import { hundredthsOf, quoteTotals, type CalcLine, type CalcSettings } from './calc';

// The limits of the service (`app/core/quoting.py`), so the form refuses what it would answer with a 422.
export const MAX_LINES = 200;
const MAX_UNITS = 100_000;
const MAX_HOURS_HUNDREDTHS = 1_000_000; // 10,000 hours
const MAX_COUNT = 1_000;
const MAX_RATE_CENTS = 10_000_000; // 100,000.00 an hour
const MAX_PERCENT_HUNDREDTHS = 10_000; // 100 %
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

/** A percentage from 0 to 100, to the hundredth. */
function percentProblem(text: string): string | null {
  if (text === '') return 'Percentage is required';
  if (!HUNDREDTHS_TEXT.test(text)) return 'Enter a percentage like 7.5';
  return hundredthsOf(text) > MAX_PERCENT_HUNDREDTHS ? 'Percentage must be from 0 to 100' : null;
}

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
  description: z.string(),
  units: z.number().int(),
  hoursPerUnit: z.number(),
});

// Hours, person-days and months are decimal numbers on the wire (1188, 2.48); every cost is whole minor units.
const quoteTotalsRowSchema = z.object({
  baseHours: z.number(),
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
  negotiationBufferPercent: z.number(),
  managementPercent: z.number(),
  testingPercent: z.number(),
  bugFixPercent: z.number(),
  hoursPerDay: z.number().int(),
  hoursPerMonth: z.number().int(),
  updatedDate: z.string(),
  lines: z.array(quoteLineRowSchema),
  totals: quoteTotalsRowSchema,
});

export const quoteRowsSchema = z.array(quoteRowSchema);

export type QuoteRow = z.output<typeof quoteRowSchema>;

// Every field is text, so a blank field can be told from a typed one. The settings are in the form with the lines, so a
// drawer that closes keeps what was typed and one save stores it all.
const settingsShape = {
  currencyCode: textField(currencyProblem),
  developerCount: textField(countProblem),
  developerRate: textField(rateProblem),
  managerCount: textField(countProblem),
  managerRate: textField(rateProblem),
  testerCount: textField(countProblem),
  testerRate: textField(rateProblem),
  negotiationBufferPercent: textField(percentProblem),
  managementPercent: textField(percentProblem),
  testingPercent: textField(percentProblem),
  bugFixPercent: textField(percentProblem),
  hoursPerDay: textField(hoursPerDayProblem),
  hoursPerMonth: textField(hoursPerMonthProblem),
};

const settingsSchema = z.object(settingsShape);

const quoteLineSchema = z.object({
  description: z.string().trim().min(1, 'Description is required'),
  units: textField(unitsProblem),
  hoursPerUnit: textField(hoursProblem),
});

export const quoteFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required'),
    ...settingsShape,
    lines: z
      .array(quoteLineSchema)
      .min(1, 'Add at least one line')
      .max(MAX_LINES, `A quote can have up to ${MAX_LINES} lines`),
  })
  .superRefine((values, context) => {
    // Each field can be in range while the quote is not: the service refuses a final quote above the largest amount. Said
    // once, on the lines (they are what to reduce, with the rates), and only while the settings are valid.
    if (quoteTooLarge(values)) context.addIssue({ code: 'custom', path: ['lines'], message: TOO_LARGE });
  });

export type QuoteFormValues = z.infer<typeof quoteFormSchema>;

/** Every field the settings drawer holds: all but the title and the lines. */
export const SETTINGS_FIELDS = Object.keys(settingsShape) as readonly (keyof QuoteFormValues)[];

export const blankQuoteLine: QuoteFormValues['lines'][number] = { description: '', units: '1', hoursPerUnit: '' };

export const emptyQuoteForm: QuoteFormValues = {
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
  lines: [{ ...blankQuoteLine }],
};

export function toQuoteFormValues(row?: QuoteRow): QuoteFormValues {
  if (!row) return { ...emptyQuoteForm, lines: [{ ...blankQuoteLine }] };
  return {
    title: row.title,
    currencyCode: row.currencyCode,
    developerCount: String(row.developerCount),
    developerRate: toAmountText(row.developerRateCents),
    managerCount: String(row.managerCount),
    managerRate: toAmountText(row.managerRateCents),
    testerCount: String(row.testerCount),
    testerRate: toAmountText(row.testerRateCents),
    negotiationBufferPercent: String(row.negotiationBufferPercent),
    managementPercent: String(row.managementPercent),
    testingPercent: String(row.testingPercent),
    bugFixPercent: String(row.bugFixPercent),
    hoursPerDay: String(row.hoursPerDay),
    hoursPerMonth: String(row.hoursPerMonth),
    lines:
      row.lines.length > 0
        ? row.lines.map((line) => ({
            description: line.description,
            units: String(line.units),
            hoursPerUnit: String(line.hoursPerUnit),
          }))
        : [{ ...blankQuoteLine }],
  };
}

export interface QuoteLineBody {
  description: string;
  units: number;
  hoursPerUnit: number;
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
  negotiationBufferPercent: number;
  managementPercent: number;
  testingPercent: number;
  bugFixPercent: number;
  hoursPerDay: number;
  hoursPerMonth: number;
  /** The whole set: the service replaces the quote's lines with these. */
  lines: QuoteLineBody[];
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
    negotiationBufferPercent: number(values.negotiationBufferPercent),
    managementPercent: number(values.managementPercent),
    testingPercent: number(values.testingPercent),
    bugFixPercent: number(values.bugFixPercent),
    hoursPerDay: number(values.hoursPerDay),
    hoursPerMonth: number(values.hoursPerMonth),
    lines: values.lines.map((line) => ({
      description: line.description.trim(),
      units: number(line.units),
      hoursPerUnit: number(line.hoursPerUnit),
    })),
  };
}

/**
 * What the totals are calculated from, as the form stands. `settings` is null while any settings field is invalid: the
 * mirror throws on a zero count, day or month and on a fraction, and the money is formatted in the currency, so a blank
 * or wrong setting means no totals, never a wrong or broken one. A line whose units or hours are invalid is left out, as
 * if they were zero.
 */
export function toCalcInput(values: QuoteFormValues): { settings: CalcSettings | null; lines: CalcLine[] } {
  const lines = values.lines.flatMap((line) => {
    const units = line.units.trim();
    const hours = line.hoursPerUnit.trim();
    return unitsProblem(units) === null && hoursProblem(hours) === null
      ? [{ units: Number(units), hoursHundredths: hundredthsOf(hours) }]
      : [];
  });
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
    },
    lines,
  };
}

/** Whether the final quote is above the largest amount the service accepts. False while the settings are invalid. */
export function quoteTooLarge(values: QuoteFormValues): boolean {
  const { settings, lines } = toCalcInput(values);
  return settings !== null && quoteTotals(settings, lines).finalQuoteCents > MAX_CENTS;
}
