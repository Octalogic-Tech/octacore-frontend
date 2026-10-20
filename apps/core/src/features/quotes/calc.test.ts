import { bufferedHours, formatHours, hundredthsOf, quoteTotals, type CalcLine, type CalcSettings, type QuoteTotals } from './calc';

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
  timeBufferBp: 0,
  discountBp: 0,
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
      timeBufferHours: 0,
      bufferedBaseHours: 118_800,
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
      discountCents: 0,
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
      timeBufferBp: 0,
      discountBp: 0,
    };

    const expected: QuoteTotals = {
      baseHours: 2809,
      timeBufferHours: 0,
      bufferedBaseHours: 2809,
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
      discountCents: 0,
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
      timeBufferBp: 0,
      discountBp: 0,
    };

    const expected: QuoteTotals = {
      baseHours: 19_999_780_000_200,
      timeBufferHours: 0,
      bufferedBaseHours: 19_999_780_000_200,
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
      discountCents: 0,
      finalQuoteCents: Number(23_995_733_864_660_021_617n),
    };
    expect(quoteTotals(settings, lines)).toEqual(expected);
  });

  it('a huge quote with a time buffer and a discount is exact too', () => {
    // The same quote with the time buffer at 99.99 % and the discount at 49.99 %. The padded hours are 4 x 10^13 hundredths,
    // and the discount multiplies an amount of 4.8 x 10^19 cents by 4,999: far past 2^53, so a float would be off. The values
    // are the service's own (`compute_totals` with time_buffer_percent 99.99 and discount_percent 49.99).
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
      timeBufferBp: 9_999,
      discountBp: 4_999,
    };

    const expected: QuoteTotals = {
      baseHours: 19_999_780_000_200,
      timeBufferHours: 19_997_780_022_200,
      bufferedBaseHours: 39_997_560_022_400,
      testingHours: 39_993_560_266_398,
      bugFixHours: 39_993_560_266_398,
      developmentHours: 79_991_120_288_798,
      buildHours: 119_984_680_555_196,
      managementHours: 119_972_682_087_140,
      totalHours: 239_957_362_642_336,
      developmentHoursPerPerson: 79_991_120_288_798,
      managementHoursPerPerson: 119_972_682_087_140,
      testingHoursPerPerson: 39_993_560_266_398,
      personDays: 239_957_362_642_336,
      elapsedMonths: 119_984_680_555_196,
      developmentCostCents: Number(7_999_111_228_968_597_112n),
      managementCostCents: Number(11_997_267_008_987_179_129n),
      testingCostCents: Number(3_999_355_626_704_197_336n),
      subtotalCents: Number(23_995_733_864_659_973_577n),
      negotiationBufferCents: Number(23_993_334_291_273_507_580n),
      discountCents: Number(23_989_735_171_151_147_230n),
      finalQuoteCents: Number(23_999_332_984_782_333_927n),
    };
    expect(quoteTotals(settings, lines)).toEqual(expected);
  });

  describe('the time buffer and the discount', () => {
    // The third vector, written by the backend (`tests/test_quoting.py`, the numbers of its report): a time buffer of 12.5 %
    // and a discount of 7.5 %, each with a tie, and every other setting off its default.
    const third: CalcSettings = {
      developerCount: 2,
      developerRateCents: 150_000,
      managerCount: 1,
      managerRateCents: 180_000,
      testerCount: 1,
      testerRateCents: 90_000,
      negotiationBufferBp: 1000,
      managementBp: 2000,
      testingBp: 1000,
      bugFixBp: 500,
      hoursPerDay: 8,
      hoursPerMonth: 160,
      timeBufferBp: 1250,
      discountBp: 750,
    };
    const thirdLines: CalcLine[] = [
      { units: 1, hoursHundredths: hundredthsOf('10.12') },
      { units: 3, hoursHundredths: hundredthsOf('2.50') },
      { units: 2, hoursHundredths: hundredthsOf('7.25') },
      { units: 1, hoursHundredths: hundredthsOf('0.20') },
    ];

    it('the third vector comes out field by field as the service has it', () => {
      const expected: QuoteTotals = {
        // Per line, in hundredths: 1012 -> 1138.5 -> 1139 (a tie, up), 750 -> 843.75 -> 844, 1450 -> 1631.25 -> 1631 and
        // 20 -> 22.5 -> 23 (a tie, up). Padding the sum, 3232 x 1.125, would be 3636, not 3637.
        baseHours: 3232,
        timeBufferHours: 405,
        bufferedBaseHours: 3637,
        testingHours: 364, // 363.7
        bugFixHours: 182, // 181.85
        developmentHours: 3819,
        buildHours: 4183,
        managementHours: 837, // 836.6
        totalHours: 5020,
        developmentHoursPerPerson: 1910, // 1909.5, an exact tie
        managementHoursPerPerson: 837,
        testingHoursPerPerson: 364,
        personDays: 628, // 627.5, an exact tie
        elapsedMonths: 13, // 4183 / 320 is 13.07
        developmentCostCents: 5_728_500,
        managementCostCents: 1_506_600,
        testingCostCents: 327_600,
        subtotalCents: 7_562_700,
        negotiationBufferCents: 756_270,
        // The amount before the discount is 8,318,970; 7.5 % of it is 623,922.75, which is floored (half up would be 623,923).
        discountCents: 623_922,
        finalQuoteCents: 7_695_048,
      };
      expect(quoteTotals(third, thirdLines)).toEqual(expected);
    });

    it('pads every line on its own, half up, and not the sum of the lines', () => {
      const { bufferedBaseHours } = quoteTotals(third, thirdLines);
      expect(bufferedBaseHours).toBe(1139 + 844 + 1631 + 23);
      // The same sum through the column's own helper, a line at a time.
      expect([1012, 750, 1450, 20].reduce((sum, hours) => sum + bufferedHours(hours, 1250), 0)).toBe(bufferedBaseHours);
      expect(bufferedHours(3232, 1250)).toBe(3636);
    });

    it('takes the discount by flooring, so no part of a cent is taken off', () => {
      // 1 hour at 123.51 an hour with no management: a subtotal of 12,351, a 10 % negotiation buffer of 1,235 (1,235.1) and a
      // 10 % discount of 1,358.6 on 13,586. Half up would take 1,359 off.
      const one: CalcSettings = {
        ...defaults,
        developerRateCents: 12_351,
        managementBp: 0,
        negotiationBufferBp: 1000,
        discountBp: 1000,
      };
      const totals = quoteTotals(one, [{ units: 1, hoursHundredths: 100 }]);
      expect(totals.subtotalCents).toBe(12_351);
      expect(totals.negotiationBufferCents).toBe(1235);
      expect(totals.discountCents).toBe(1358);
      expect(totals.finalQuoteCents).toBe(12_228);
    });

    it('takes nothing off while the discount is less than a cent, and the whole cents below a part of one', () => {
      const lines: CalcLine[] = [{ units: 1, hoursHundredths: 100 }];
      const bare: CalcSettings = { ...defaults, managementBp: 0, negotiationBufferBp: 0 };
      // 0.01 % of 99.99 is 0.9999 of a cent: half up would take a cent off, flooring takes none.
      const nearlyACent = quoteTotals({ ...bare, developerRateCents: 9999, discountBp: 1 }, lines);
      expect(nearlyACent.discountCents).toBe(0);
      expect(nearlyACent.finalQuoteCents).toBe(9999);
      // 0.99 % of 999.99 is 989.9901 cents: 989, where half up would give 990.
      const almost = quoteTotals({ ...bare, developerRateCents: 99_999, discountBp: 99 }, lines);
      expect(almost.discountCents).toBe(989);
      expect(almost.finalQuoteCents).toBe(99_999 - 989);
    });

    it('comes off after the negotiation buffer is added, not off the subtotal alone', () => {
      const one: CalcSettings = {
        ...defaults,
        developerRateCents: 12_351,
        managementBp: 0,
        negotiationBufferBp: 1000,
        discountBp: 1000,
      };
      const lines: CalcLine[] = [{ units: 1, hoursHundredths: 100 }];
      const both = quoteTotals(one, lines);
      const noBuffer = quoteTotals({ ...one, negotiationBufferBp: 0 }, lines);
      // 10 % off the subtotal alone is 1,235 and the 10 % buffer adds 1,235 back: that is not what the quote does.
      expect(noBuffer.finalQuoteCents).toBe(12_351 - 1235);
      expect(both.discountCents).toBe(Math.floor((both.subtotalCents + both.negotiationBufferCents) / 10));
      expect(both.finalQuoteCents).toBe(both.subtotalCents + both.negotiationBufferCents - both.discountCents);
      const offTheSubtotalOnly = both.subtotalCents + both.negotiationBufferCents - Math.floor(both.subtotalCents / 10);
      expect(both.finalQuoteCents).not.toBe(offTheSubtotalOnly);
    });

    it('feeds every hours figure and every cost from the padded hours: a 50 % pad on 10 hours is 15 hours', () => {
      const settings: CalcSettings = {
        developerCount: 3,
        developerRateCents: 310_000,
        managerCount: 1,
        managerRateCents: 300_000,
        testerCount: 1,
        testerRateCents: 100_000,
        negotiationBufferBp: 0,
        managementBp: 2000,
        testingBp: 1000,
        bugFixBp: 1000,
        hoursPerDay: 6,
        hoursPerMonth: 160,
        timeBufferBp: 5000,
        discountBp: 0,
      };
      const padded = quoteTotals(settings, [{ units: 1, hoursHundredths: 1000 }]);
      const direct = quoteTotals({ ...settings, timeBufferBp: 0 }, [{ units: 1, hoursHundredths: 1500 }]);
      expect(padded).toMatchObject({
        baseHours: 1000,
        timeBufferHours: 500,
        bufferedBaseHours: 1500,
        testingHours: 150,
        bugFixHours: 150,
        developmentHours: 1650,
        buildHours: 1800,
        managementHours: 360,
        totalHours: 2160,
        developmentHoursPerPerson: 550,
        personDays: 360,
        elapsedMonths: 4, // 1800 / 480 is 3.75
        developmentCostCents: 5_115_000,
        managementCostCents: 1_080_000,
        testingCostCents: 150_000,
        subtotalCents: 6_345_000,
        finalQuoteCents: 6_345_000,
      });
      // Everything after the lines is what 15 hours of lines give with no time buffer.
      const { baseHours: _base, timeBufferHours: _added, ...afterTheLines } = padded;
      const { baseHours: _directBase, timeBufferHours: _directAdded, ...directAfterTheLines } = direct;
      void [_base, _added, _directBase, _directAdded];
      expect(afterTheLines).toEqual(directAfterTheLines);
    });

    it('leaves the hours alone when only the negotiation buffer changes', () => {
      const lines: CalcLine[] = [
        { units: 1, hoursHundredths: 2400 },
        { units: 2, hoursHundredths: 2800 },
        { units: 1, hoursHundredths: 1650 },
      ];
      const none = quoteTotals({ ...defaults, negotiationBufferBp: 0 }, lines);
      const some = quoteTotals({ ...defaults, negotiationBufferBp: 2500 }, lines);
      const lots = quoteTotals({ ...defaults, negotiationBufferBp: 10_000 }, lines);
      const money = ['negotiationBufferCents', 'finalQuoteCents'] as const;
      for (const other of [some, lots]) {
        for (const field of Object.keys(none) as (keyof QuoteTotals)[]) {
          if (!money.some((name) => name === field)) expect([field, other[field]]).toEqual([field, none[field]]);
        }
      }
      expect(none.negotiationBufferCents).toBe(0);
      expect(some.negotiationBufferCents).toBe(9_288_500);
      expect(lots.negotiationBufferCents).toBe(lots.subtotalCents);
      expect(none.finalQuoteCents).toBe(none.subtotalCents);
    });

    it('is the default example of the plan at the defaults, and at a 10 % time buffer and a 10 % discount', () => {
      // 24, 2 x 28 and 16.5 hours: 96.5 in all.
      const lines: CalcLine[] = [
        { units: 1, hoursHundredths: 2400 },
        { units: 2, hoursHundredths: 2800 },
        { units: 1, hoursHundredths: 1650 },
      ];
      const plain = quoteTotals(defaults, lines);
      expect(plain).toMatchObject({
        baseHours: 9650,
        timeBufferHours: 0,
        bufferedBaseHours: 9650,
        managementHours: 2413,
        totalHours: 12_063,
        discountCents: 0,
        finalQuoteCents: 46_442_500,
      });

      // The service's own figures (`compute_totals` on these settings and lines).
      const padded = quoteTotals({ ...defaults, timeBufferBp: 1000, discountBp: 1000 }, lines);
      expect(padded).toMatchObject({
        baseHours: 9650,
        timeBufferHours: 965,
        bufferedBaseHours: 10_615,
        developmentHours: 10_615,
        developmentHoursPerPerson: 3538,
        managementHours: 2654,
        totalHours: 13_269,
        personDays: 2212,
        elapsedMonths: 22,
        developmentCostCents: 32_906_500,
        managementCostCents: 7_962_000,
        subtotalCents: 40_868_500,
        negotiationBufferCents: 10_217_125,
        discountCents: 5_108_562,
        finalQuoteCents: 45_977_063,
      });
    });
  });
});

describe('bufferedHours', () => {
  it('adds the time buffer to a line\'s hours, half up', () => {
    // The plan's example at a 25 % buffer: 24, 2 x 28 and 16.5 hours.
    expect(bufferedHours(2400, 2500)).toBe(3000);
    expect(bufferedHours(5600, 2500)).toBe(7000);
    // 16.5 x 1.25 is 20.625: the half goes up.
    expect(bufferedHours(1650, 2500)).toBe(2063);
    // 1.5 x 1.25 is 1.875 hours, 187.5 hundredths: a tie, rounded up.
    expect(bufferedHours(150, 2500)).toBe(188);
    expect(bufferedHours(2400, 1000)).toBe(2640);
    expect(bufferedHours(1650, 1000)).toBe(1815);
  });

  it('leaves the hours alone at 0 % and doubles them at 100 %', () => {
    expect(bufferedHours(1650, 0)).toBe(1650);
    expect(bufferedHours(1650, 10_000)).toBe(3300);
    expect(bufferedHours(0, 2500)).toBe(0);
  });

  it('is exact for the largest line the form allows (100,000 units of 10,000 hours) at 100 %', () => {
    expect(bufferedHours(100_000 * 1_000_000, 10_000)).toBe(200_000_000_000);
    expect(bufferedHours(100_000 * 1_000_000 + 1, 2500)).toBe(125_000_000_001);
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
