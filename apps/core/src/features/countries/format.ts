// The service stores 0 where a country has no ISO numeric code or no calling code (Antarctica, for one).
const NONE = '—';

export const formatIso3 = (code: string): string => code || NONE;

export const formatPhoneCode = (code: number): string => (code > 0 ? `+${code}` : NONE);

/** ISO 3166 prints numeric codes with three digits: 004, not 4. */
export const formatNumericCode = (code: number): string => (code > 0 ? String(code).padStart(3, '0') : NONE);
