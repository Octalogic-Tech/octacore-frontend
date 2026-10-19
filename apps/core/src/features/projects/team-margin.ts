import { convertToCents } from '@/features/expenses/money';
import type { PersonRow } from '@/features/people/schema';
import type { ResourceRow } from './schema';

/** A copy of the service's `RETAINER_HOURS`: a retainer bills each resource for this many hours a month. */
export const RETAINER_HOURS = 160;

export interface TeamMargin {
  /** The resources that could be counted, and how many there are in all. */
  counted: number;
  total: number;
  /** A month's billing and salary cost of the counted resources, in whole US cents. */
  billed: number;
  cost: number;
  /** Billed less cost; negative when the salaries are more than the billing. */
  margin: number;
  /** The margin's size over billed, to a whole number, a half rounding away from zero; null when billed is 0. */
  percent: number | null;
}

/**
 * What a retainer's team bills in a month against what its people are paid. A resource counts only when it has a
 * person whose salary is known and a Qty of 1: one person's salary cannot stand for several. A person missing from
 * `people` (deleted) has no known salary.
 *
 * Salaries are in INR paise and the billing is in US cents, so each counted salary is turned into US cents at
 * `inrPerUsd` (India's rate: rupees to the dollar), the service's own way: half a cent rounds up, on integers. Without
 * a usable rate (null, or not above zero) nothing can be compared and nothing is counted.
 */
export function teamMargin(
  resources: readonly ResourceRow[],
  people: readonly PersonRow[],
  inrPerUsd: number | null,
): TeamMargin {
  const salaryOf = new Map(people.map((person) => [person.id, person.monthlySalaryPaise]));
  const hasRate = inrPerUsd !== null && inrPerUsd > 0;
  let counted = 0;
  let billed = 0;
  let cost = 0;
  for (const resource of resources) {
    const salary = resource.personId === null ? null : (salaryOf.get(resource.personId) ?? null);
    if (!hasRate || salary === null || resource.headcount !== 1) continue;
    counted += 1;
    billed += resource.rateCents * RETAINER_HOURS;
    cost += convertToCents(salary, inrPerUsd);
  }
  const margin = billed - cost;
  // 100 x |margin| / billed, with a half going up, in integers so no float can put a half on the wrong side.
  const percent = billed === 0 ? null : Math.floor((Math.abs(margin) * 200 + billed) / (2 * billed));
  return { counted, total: resources.length, billed, cost, margin, percent };
}
