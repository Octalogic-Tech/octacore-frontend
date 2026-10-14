import { formatIso3, formatNumericCode, formatPhoneCode } from './format';

describe('formatPhoneCode', () => {
  it('shows a calling code with a plus', () => {
    expect(formatPhoneCode(93)).toBe('+93');
    expect(formatPhoneCode(1684)).toBe('+1684');
  });

  it('shows a dash where the data has no calling code (it stores 0)', () => {
    expect(formatPhoneCode(0)).toBe('—');
  });
});

describe('formatNumericCode', () => {
  it('pads the ISO numeric code to three digits, as ISO prints it', () => {
    expect(formatNumericCode(4)).toBe('004');
    expect(formatNumericCode(826)).toBe('826');
  });

  it('shows a dash where the data has no numeric code (it stores 0)', () => {
    expect(formatNumericCode(0)).toBe('—');
  });
});

describe('formatIso3', () => {
  it('shows the code, or a dash where there is none', () => {
    expect(formatIso3('AFG')).toBe('AFG');
    expect(formatIso3('')).toBe('—');
  });
});
