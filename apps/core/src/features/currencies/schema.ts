import { z } from 'zod';

export const PRIMARY_CURRENCY = 'USD';

const RATE_TEXT = /^(\d{1,7})(?:\.(\d{1,6}))?$/;
const MAX_RATE = 1_000_000;

/** What is wrong with typed rate text, or null. A comma or a seventh decimal is told, not dropped. */
export function rateProblem(text: string): string | null {
  const value = text.trim();
  if (value === '') return 'Enter a rate';
  if (!RATE_TEXT.test(value)) return 'Enter a rate like 88.25, with no commas and at most six decimals';
  const rate = Number(value);
  if (rate <= 0) return 'The rate must be more than zero';
  if (rate > MAX_RATE) return 'The rate is too large';
  return null;
}

export const currencyFormSchema = z
  .object({
    // The input writes capitals as they are typed, so a lower-case code only gets here by being pasted.
    code: z.string().trim().regex(/^[A-Z]{3}$/, 'Three capital letters, like EUR'),
    name: z.string().trim().min(1, 'Name is required'),
    symbol: z.string().trim().min(1, 'Symbol is required').max(4, 'Up to four characters'),
    // Text, so a comma or a stray letter can be told what is wrong.
    rate: z.string(),
  })
  .superRefine((values, context) => {
    const problem = rateProblem(values.rate);
    if (problem) context.addIssue({ code: 'custom', path: ['rate'], message: problem });
  });

export type CurrencyFormValues = z.infer<typeof currencyFormSchema>;

export const emptyCurrencyForm: CurrencyFormValues = { code: '', name: '', symbol: '', rate: '' };

// Only what the page uses. The service also sends `status` and the created and deleted dates.
export const currencyRowSchema = z.object({
  id: z.number().int(),
  code: z.string(),
  name: z.string(),
  symbol: z.string(),
  // Units of this currency per 1 US dollar. USD is always 1.
  rate: z.number(),
  updatedDate: z.string(),
});

export const currencyRowsSchema = z.array(currencyRowSchema);

export type CurrencyRow = z.output<typeof currencyRowSchema>;

export interface CurrencyBody {
  code: string;
  name: string;
  symbol: string;
  rate: number;
}

export function toCurrencyBody(values: CurrencyFormValues): CurrencyBody {
  return { code: values.code, name: values.name, symbol: values.symbol, rate: Number(values.rate.trim()) };
}
