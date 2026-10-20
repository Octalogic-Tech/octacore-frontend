// Rows shaped like GET http://localhost:5001/api/v1/quotations (octacore-backend, FastAPI), in the service's own envelope;
// the names and dates are made up, the figures are real. Each row carries its settings flat, its lines and the `totals`
// the service calculates from them: hours and months as decimal numbers (1188, 2.48), every cost in whole minor units.
//
// Quote 1 is the workbook of the design's section 3.4: 53 lines of one unit each (1,188 hours) at the default settings
// (3 developers at 3,100.00, a manager at 3,000.00, a tester at 0.00, a 25 % buffer and 25 % management, 6 hours a day,
// 160 a month), in rupees: a final quote of 5,717,250.00. Quote 2 is the second vector, chosen so every step rounds half
// up (testing 10 %, bug fixing 5 %, a fractional hour, two developers and two testers), in dollars: a final quote of
// 50,844.43. Both are asserted against the mirror in `features/quotes/calc.ts` by `schema.test.ts`.
const stamp = '2026-10-15T09:30:00.000000Z';
const later = '2026-10-18T14:05:00.000000Z';
const audit = { status: 1, createdDate: stamp, updatedDate: stamp, deletedDate: null };

// The hours of a workbook line and how many lines have them.
const workbookHours: [hours: number, lines: number][] = [
  [16, 24],
  [24, 14],
  [32, 4],
  [8, 3],
  [20, 3],
  [48, 3],
  [56, 2],
];

const workbookLines = workbookHours
  .flatMap(([hours, count]) => Array.from({ length: count }, () => hours))
  .map((hoursPerUnit, index) => ({
    id: index + 1,
    title: `Workbook item ${index + 1}`,
    description: `What workbook item ${index + 1} covers`,
    units: 1,
    hoursPerUnit,
  }));

export const quoteRows = [
  {
    ...audit,
    id: 1,
    title: 'Acme storefront',
    currencyCode: 'INR',
    developerCount: 3,
    developerRateCents: 310_000,
    managerCount: 1,
    managerRateCents: 300_000,
    testerCount: 1,
    testerRateCents: 0,
    negotiationBufferPercent: 25,
    managementPercent: 25,
    testingPercent: 0,
    bugFixPercent: 0,
    hoursPerDay: 6,
    hoursPerMonth: 160,
    lines: workbookLines,
    totals: {
      baseHours: 1188,
      testingHours: 0,
      bugFixHours: 0,
      developmentHours: 1188,
      buildHours: 1188,
      managementHours: 297,
      totalHours: 1485,
      developmentHoursPerPerson: 396,
      managementHoursPerPerson: 297,
      testingHoursPerPerson: 0,
      personDays: 247.5,
      elapsedMonths: 2.48,
      developmentCostCents: 368_280_000,
      managementCostCents: 89_100_000,
      testingCostCents: 0,
      subtotalCents: 457_380_000,
      negotiationBufferCents: 114_345_000,
      finalQuoteCents: 571_725_000,
    },
  },
  {
    ...audit,
    id: 2,
    updatedDate: later,
    title: 'Dashboard refresh',
    currencyCode: 'USD',
    developerCount: 2,
    developerRateCents: 123_456,
    managerCount: 1,
    managerRateCents: 200_000,
    testerCount: 2,
    testerRateCents: 99_999,
    negotiationBufferPercent: 7.5,
    managementPercent: 12.5,
    testingPercent: 10,
    bugFixPercent: 5,
    hoursPerDay: 7,
    hoursPerMonth: 150,
    lines: [
      { id: 54, title: 'Sign-in screens', description: 'Email and password, with a reset link', units: 2, hoursPerUnit: 7.5 },
      { id: 55, title: 'Chart tiles', description: 'Revenue, hours and margin', units: 3, hoursPerUnit: 0.25 },
      { id: 56, title: 'Export to CSV', description: 'Every table, as shown', units: 1, hoursPerUnit: 12.34 },
    ],
    totals: {
      baseHours: 28.09,
      testingHours: 2.81,
      bugFixHours: 1.4,
      developmentHours: 29.49,
      buildHours: 32.3,
      managementHours: 4.04,
      totalHours: 36.34,
      developmentHoursPerPerson: 14.75,
      managementHoursPerPerson: 4.04,
      testingHoursPerPerson: 1.41,
      personDays: 5.19,
      elapsedMonths: 0.11,
      developmentCostCents: 3_640_717,
      managementCostCents: 808_000,
      testingCostCents: 280_997,
      subtotalCents: 4_729_714,
      negotiationBufferCents: 354_729,
      finalQuoteCents: 5_084_443,
    },
  },
];

const envelope = (message: string, data: unknown) => ({ statusCode: 200, message, data, meta: null });

export const quotesEnvelope = (data: unknown = quoteRows) => envelope('Successfully fetched quotations', data);

export const quoteEnvelope = (data: unknown = quoteRows[0]) => envelope('Successfully fetched quotation', data);
