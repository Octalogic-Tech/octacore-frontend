import { formatRate } from '@/features/expenses/money';

const NONE = '—';

/** The rate per US dollar as the table shows it (`88.25`, `1` for US dollars), or a dash while there is none. */
export const formatCountryRate = (rate: number | null): string => (rate === null ? NONE : formatRate(rate));

/** A tax rate as a percentage without trailing zeros: `18%`, `7.5%`, `0%`. */
export const formatTaxRate = (rate: number): string => `${Number(rate.toFixed(2))}%`;
