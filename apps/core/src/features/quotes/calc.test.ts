import { formatHours, hundredthsOf, quoteTotals, type CalcLine, type CalcSettings, type QuoteTotals } from './calc';

/** The service's defaults (`DEFAULT_SETTINGS` in `app/core/quoting.py`): 3 developers at 3,100.00, a manager at 3,000.00. */
const defaults: CalcSettings = {
  developerCount: 3,
  developerRateCents: 310_000,
  managerCount: 1,
  managerRateCents: 300_000,
  testerCount: 1,
  testerRateCents: 0,
  negotiationBufferBp: 2500,
  managementBp: 2500,
  testingBp: 0,
  bugFixBp: 0,
  hoursPerDay: 6,
  hoursPerMonth: 160,
};

describe('quoteTotals', () => {
  it('the workbook lines give the workbook cost block', () => {
    // 53 lines of one unit: the hours per line and how many lines have them (1,188 hours in all).
    const hoursByCount: Record<number, number> = { 16: 24, 24: 14, 32: 4, 8: 3, 20: 3, 48: 3, 56: 2 };
    const lines: CalcLine[] = Object.entries(hoursByCount).flatMap(([hours, count]) =>
      Array.from({ length: count }, () => ({ units: 1, hoursHundredths: Number(hours) * 100 })),
    );
    expect(lines).toHaveLength(53);

    const expected: QuoteTotals = {
      baseHours: 118_800,
      testingHours: 0,
      bugFixHours: 0,
      developmentHours: 118_800,
      buildHours: 118_800,
      managementHours: 29_700,
      totalHours: 148_500,
      developmentHoursPerPerson: 39_600,
      managementHoursPerPerson: 29_700,
      testingHoursPerPerson: 0,
      personDays: 24_750,
      elapsedMonths: 248,
      developmentCostCents: 368_280_000,
      managementCostCents: 89_100_000,
      testingCostCents: 0,
      subtotalCents: 457_380_000,
      negotiationBufferCents: 114_345_000,
      finalQuoteCents: 571_725_000,
    };
    expect(quoteTotals(defaults, lines)).toEqual(expected);
  });

  it('every step rounds half up', () => {
    const lines: CalcLine[] = [
      { units: 2, hoursHundredths: hundredthsOf('7.5') },
      { units: 3, hoursHundredths: hundredthsOf('0.25') },
      { units: 1, hoursHundredths: hundredthsOf('12.34') },
    ];
    const settings: CalcSettings = {
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
    };

    const expected: QuoteTotals = {
      baseHours: 2809,
      testingHours: 281, // 280.9
      bugFixHours: 140, // 140.45
      developmentHours: 2949,
      buildHours: 3230,
      managementHours: 404, // 403.75
      totalHours: 3634,
      developmentHoursPerPerson: 1475, // 1474.5, an exact tie
      managementHoursPerPerson: 404,
      testingHoursPerPerson: 141, // 140.5, an exact tie
      personDays: 519, // 519.14
      elapsedMonths: 11, // 10.77
      developmentCostCents: 3_640_717, // 3,640,717.44
      managementCostCents: 808_000,
      testingCostCents: 280_997, // 280,997.19
      subtotalCents: 4_729_714,
      negotiationBufferCents: 354_729, // 354,728.55
      finalQuoteCents: 5_084_443,
    };
    expect(quoteTotals(settings, lines)).toEqual(expected);
  });

  it('a quote with no lines costs nothing', () => {
    const totals = quoteTotals(defaults, []);
    expect(totals.baseHours).toBe(0);
    expect(totals.totalHours).toBe(0);
    expect(totals.finalQuoteCents).toBe(0);
  });

  it('a huge quote does not overflow', () => {
    // 200 lines of 100,000 units at 10,000 hours each, every rate at its maximum and every percent at 100 %: the product
    // passes 2^53 several times over, where a float would round it.
    const lines: CalcLine[] = Array.from({ length: 200 }, () => ({ units: 100_000, hoursHundredths: 1_000_000 }));
    const settings: CalcSettings = {
      developerCount: 1,
      developerRateCents: 10_000_000,
      managerCount: 1,
      managerRateCents: 10_000_000,
      testerCount: 1,
      testerRateCents: 10_000_000,
      negotiationBufferBp: 10_000,
      managementBp: 10_000,
      testingBp: 10_000,
      bugFixBp: 10_000,
      hoursPerDay: 1,
      hoursPerMonth: 1,
    };

    let totals: QuoteTotals | undefined;
    expect(() => {
      totals = quoteTotals(settings, lines);
    }).not.toThrow();
    for (const [name, value] of Object.entries(totals as QuoteTotals)) {
      expect(Number.isFinite(value), name).toBe(true);
    }
    expect((totals as QuoteTotals).baseHours).toBe(200 * 100_000 * 1_000_000);
    expect((totals as QuoteTotals).finalQuoteCents).toBeGreaterThan(10_000_000_000);
  });
});

describe('hundredthsOf', () => {
  it('reads text with at most two decimals into hundredths', () => {
    expect(hundredthsOf('7.5')).toBe(750);
    expect(hundredthsOf('0.25')).toBe(25);
    expect(hundredthsOf('12.34')).toBe(1234);
    expect(hundredthsOf('16')).toBe(1600);
    expect(hundredthsOf('0')).toBe(0);
    expect(hundredthsOf('0.01')).toBe(1);
  });
});

describe('formatHours', () => {
  it('groups thousands and drops trailing zeros', () => {
    expect(formatHours(118_800)).toBe('1,188');
    expect(formatHours(3634)).toBe('36.34');
    expect(formatHours(250)).toBe('2.5');
    expect(formatHours(0)).toBe('0');
    expect(formatHours(1)).toBe('0.01');
  });

  it('keeps a leading zero in the decimals and groups the millions', () => {
    expect(formatHours(5)).toBe('0.05');
    expect(formatHours(100)).toBe('1');
    expect(formatHours(100_000_050)).toBe('1,000,000.5');
  });
});
