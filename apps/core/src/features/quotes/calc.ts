/**
 * The quotation calculation, mirrored from the service (`app/core/quoting.py`) so the editor's live totals equal what the
 * service stores. Both sides work on integers: hours in hundredths (`118800` is 1,188 hours), percents in hundredths of a
 * percent (`2500` is 25 %), money in cents, and every division rounds half up. Every product and division runs on `BigInt`:
 * the largest quote's base is 2 x 10^13 hundredths of an hour, which a float holds, but the steps after it (the base times
 * a percent in hundredths, hours times a rate) pass 2^53, where a float would lose the half. The result becomes a `Number`
 * only at the end.
 *
 * Every input is a whole number, the counts and the hours per day and per month at least 1: the form checks them first and
 * does not ask for totals until they are valid (a zero divisor or a fraction throws, as `BigInt` does).
 */

export interface CalcSettings {
  developerCount: number;
  developerRateCents: number;
  managerCount: number;
  managerRateCents: number;
  testerCount: number;
  testerRateCents: number;
  /** Hundredths of a percent: 25 % is `2500`. */
  negotiationBufferBp: number;
  managementBp: number;
  testingBp: number;
  bugFixBp: number;
  hoursPerDay: number;
  hoursPerMonth: number;
}

export interface CalcLine {
  units: number;
  /** Hours per unit in hundredths: 7.5 hours is `750`. */
  hoursHundredths: number;
}

/** The service's `totals`, with every hours field, `personDays` and `elapsedMonths` in hundredths and costs in cents. */
export interface QuoteTotals {
  baseHours: number;
  testingHours: number;
  bugFixHours: number;
  developmentHours: number;
  buildHours: number;
  managementHours: number;
  totalHours: number;
  developmentHoursPerPerson: number;
  managementHoursPerPerson: number;
  testingHoursPerPerson: number;
  personDays: number;
  elapsedMonths: number;
  developmentCostCents: number;
  managementCostCents: number;
  testingCostCents: number;
  subtotalCents: number;
  negotiationBufferCents: number;
  finalQuoteCents: number;
}

/** `n / d` with halves going up, for a non-negative `n` and a positive `d`. */
function divHalfUp(n: bigint, d: bigint): bigint {
  return (2n * n + d) / (2n * d);
}

/** `amount x bp / 10000`: a percentage given in hundredths of a percent, of hours in hundredths or of cents. */
function percentOf(amount: bigint, bp: number): bigint {
  return divHalfUp(amount * BigInt(bp), 10_000n);
}

/** `hours x rate`: hours in hundredths at a rate in cents an hour, as whole cents. */
function costOf(hoursHundredths: bigint, rateCents: number): bigint {
  return divHalfUp(hoursHundredths * BigInt(rateCents), 100n);
}

/** The totals of a quote from its settings and lines, by the formulas of the design's section 3. */
export function quoteTotals(settings: CalcSettings, lines: readonly CalcLine[]): QuoteTotals {
  const baseHours = lines.reduce((sum, line) => sum + BigInt(line.units) * BigInt(line.hoursHundredths), 0n);
  const testingHours = percentOf(baseHours, settings.testingBp);
  const bugFixHours = percentOf(baseHours, settings.bugFixBp);
  const developmentHours = baseHours + bugFixHours;
  const buildHours = baseHours + testingHours + bugFixHours;
  const managementHours = percentOf(buildHours, settings.managementBp);
  const totalHours = buildHours + managementHours;

  const developers = BigInt(settings.developerCount);
  const managers = BigInt(settings.managerCount);
  const testers = BigInt(settings.testerCount);

  // The calendar follows the build alone: the team builds while the manager manages.
  const personDays = divHalfUp(totalHours, BigInt(settings.hoursPerDay));
  const elapsedMonths = divHalfUp(buildHours, developers * BigInt(settings.hoursPerMonth));

  const developmentCost = costOf(developmentHours, settings.developerRateCents);
  const managementCost = costOf(managementHours, settings.managerRateCents);
  const testingCost = costOf(testingHours, settings.testerRateCents);
  const subtotal = developmentCost + managementCost + testingCost;
  const negotiationBuffer = percentOf(subtotal, settings.negotiationBufferBp);

  return {
    baseHours: Number(baseHours),
    testingHours: Number(testingHours),
    bugFixHours: Number(bugFixHours),
    developmentHours: Number(developmentHours),
    buildHours: Number(buildHours),
    managementHours: Number(managementHours),
    totalHours: Number(totalHours),
    developmentHoursPerPerson: Number(divHalfUp(developmentHours, developers)),
    managementHoursPerPerson: Number(divHalfUp(managementHours, managers)),
    testingHoursPerPerson: Number(divHalfUp(testingHours, testers)),
    personDays: Number(personDays),
    elapsedMonths: Number(elapsedMonths),
    developmentCostCents: Number(developmentCost),
    managementCostCents: Number(managementCost),
    testingCostCents: Number(testingCost),
    subtotalCents: Number(subtotal),
    negotiationBufferCents: Number(negotiationBuffer),
    finalQuoteCents: Number(subtotal + negotiationBuffer),
  };
}

/**
 * A line's hours with the negotiation buffer on top, as the workbook's "Hours with negotiation buffer" column shows them:
 * `hours x (10000 + bp) / 10000`, half up, in hundredths. Display only: the service applies the buffer to the cost.
 */
export function bufferedHours(hoursHundredths: number, bufferBp: number): number {
  return Number(divHalfUp(BigInt(hoursHundredths) * BigInt(10_000 + bufferBp), 10_000n));
}

/** The hundredths that text already known to be a number with at most two decimals spells: `"7.5"` is `750`. */
export function hundredthsOf(text: string): number {
  const [whole, fraction = ''] = text.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/** Hours in hundredths as people read them: grouped, up to two decimals, trailing zeros dropped (`118800` is `1,188`). */
export function formatHours(hundredths: number): string {
  const whole = Math.trunc(hundredths / 100);
  const fraction = String(Math.abs(hundredths % 100))
    .padStart(2, '0')
    .replace(/0+$/, '');
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === '' ? grouped : `${grouped}.${fraction}`;
}
