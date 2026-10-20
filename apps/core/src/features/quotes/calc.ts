/**
 * The quotation calculation, mirrored from the service (`app/core/quoting.py`) so the editor's live totals equal what the
 * service stores. Both sides work on integers: hours in hundredths (`118800` is 1,188 hours), percents in hundredths of a
 * percent (`2500` is 25 %), money in cents, and every division rounds half up except the discount's, which is floored (no
 * part of a cent is taken off). Every product and division runs on `BigInt`:
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
  /** Pads every line's hours, and so the price. 0 leaves the quote as it was. */
  timeBufferBp: number;
  /** Taken off after the negotiation buffer is added. 0 takes nothing off. */
  discountBp: number;
}

export interface CalcLine {
  units: number;
  /** Hours per unit in hundredths: 7.5 hours is `750`. */
  hoursHundredths: number;
}

/** The service's `totals`, with every hours field, `personDays` and `elapsedMonths` in hundredths and costs in cents. */
export interface QuoteTotals {
  /** The lines' own hours, as typed. */
  baseHours: number;
  /** The hours the time buffer adds: `bufferedBaseHours - baseHours`. */
  timeBufferHours: number;
  /** The lines' hours with the time buffer on each line: where every other hours figure starts. */
  bufferedBaseHours: number;
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
  /** Floored: taken off the subtotal plus the negotiation buffer. */
  discountCents: number;
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

/** `hours` padded by `bp` hundredths of a percent, half up: `hours + hours x bp / 10000`. */
function padded(hours: bigint, bp: number): bigint {
  return hours + percentOf(hours, bp);
}

/** The totals of a quote from its settings and lines, by the formulas of the design's section 8.3. */
export function quoteTotals(settings: CalcSettings, lines: readonly CalcLine[]): QuoteTotals {
  // Each line is padded by the time buffer on its own, a half going up (the editor's "Hours with buffer" column), and every
  // hours figure after it starts from the padded sum.
  const lineHours = lines.map((line) => BigInt(line.units) * BigInt(line.hoursHundredths));
  const baseHours = lineHours.reduce((sum, hours) => sum + hours, 0n);
  const bufferedBaseHours = lineHours.reduce((sum, hours) => sum + padded(hours, settings.timeBufferBp), 0n);

  const testingHours = percentOf(bufferedBaseHours, settings.testingBp);
  const bugFixHours = percentOf(bufferedBaseHours, settings.bugFixBp);
  const developmentHours = bufferedBaseHours + bugFixHours;
  const buildHours = bufferedBaseHours + testingHours + bugFixHours;
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
  // The negotiation buffer pads the amount alone, never the hours. The discount comes off what that makes, floored: the
  // product is never negative, so `BigInt` division (which cuts toward zero) is a floor here.
  const negotiationBuffer = percentOf(subtotal, settings.negotiationBufferBp);
  const amountBeforeDiscount = subtotal + negotiationBuffer;
  const discount = (amountBeforeDiscount * BigInt(settings.discountBp)) / 10_000n;

  return {
    baseHours: Number(baseHours),
    timeBufferHours: Number(bufferedBaseHours - baseHours),
    bufferedBaseHours: Number(bufferedBaseHours),
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
    discountCents: Number(discount),
    finalQuoteCents: Number(amountBeforeDiscount - discount),
  };
}

/**
 * A line's hours with the time buffer on top, as the editor's "Hours with buffer" column shows them: `hours x (10000 + bp) /
 * 10000`, half up, in hundredths. `quoteTotals` adds these up, line by line, into `bufferedBaseHours`.
 */
export function bufferedHours(hoursHundredths: number, bufferBp: number): number {
  return Number(padded(BigInt(hoursHundredths), bufferBp));
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
