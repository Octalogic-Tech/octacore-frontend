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

  it('one division gives the elapsed months: the build over the developers and the month together', () => {
    // 1.49 hours, two developers, 150 hours a month: 149 / 300 is 0 months. Dividing by the developers first (149 / 2 is 75
    // half up) and then by the month (75 / 150 is 0.5, 1 half up) would give 1. The service has the same test.
    const totals = quoteTotals({ ...defaults, developerCount: 2, hoursPerMonth: 150 }, [
      { units: 1, hoursHundredths: 149 },
    ]);
    expect(totals.buildHours).toBe(149);
    expect(totals.elapsedMonths).toBe(0);
  });

  it('a huge quote is exact, where a float would not be', () => {
    // 200 lines of 99,999 units at 9,999.99 hours, every rate at 99,999.99 an hour and every percent at 99.99 %: a quote at
    // the limits, but not a round one. The base is 2 x 10^13 hundredths of an hour, which a float holds, but the steps after
    // it (the base times 9,999, hours times a rate) pass 2^53 (about 9 x 10^15), where a float loses the half. The values
    // are the service's own (`compute_totals` in the backend on the same inputs, its hours in hundredths), not this file's.
    // The costs and the final quote come to more than 2^53, so they come back as the nearest `Number`; a float calculation
    // lands on a different one for the developer and manager costs and the final quote.
    const lines: CalcLine[] = Array.from({ length: 200 }, () => ({ units: 99_999, hoursHundredths: 999_999 }));
    const settings: CalcSettings = {
      developerCount: 1,
      developerRateCents: 9_999_999,
      managerCount: 1,
      managerRateCents: 9_999_999,
      testerCount: 1,
      testerRateCents: 9_999_999,
      negotiationBufferBp: 9_999,
      managementBp: 9_999,
      testingBp: 9_999,
      bugFixBp: 9_999,
      hoursPerDay: 1,
      hoursPerMonth: 1,
    };

    const expected: QuoteTotals = {
      baseHours: 19_999_780_000_200,
      testingHours: 19_997_780_022_200,
      bugFixHours: 19_997_780_022_200,
      developmentHours: 39_997_560_022_400,
      buildHours: 59_995_340_044_600,
      managementHours: 59_989_340_510_596,
      totalHours: 119_984_680_555_196,
      developmentHoursPerPerson: 39_997_560_022_400,
      managementHoursPerPerson: 59_989_340_510_596,
      testingHoursPerPerson: 19_997_780_022_200,
      personDays: 119_984_680_555_196,
      elapsedMonths: 59_995_340_044_600,
      developmentCostCents: Number(3_999_755_602_264_399_776n),
      managementCostCents: Number(5_998_933_451_166_194_894n),
      testingCostCents: Number(1_999_777_802_242_199_778n),
      subtotalCents: Number(11_998_466_855_672_794_448n),
      negotiationBufferCents: Number(11_997_267_008_987_227_169n),
      finalQuoteCents: Number(23_995_733_864_660_021_617n),
    };
    expect(quoteTotals(settings, lines)).toEqual(expected);
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
