import { allocationSpec } from '@/features/allocation/spec';
import { cashFlowSpec } from '@/features/cash-flow/spec';
import { currencyTaxSpec } from '@/features/currency-tax/spec';
import { milestonesSpec } from '@/features/milestones/spec';
import { moneyInCentsSpec } from '@/features/money-in-cents/spec';
import { portfolioSpec } from '@/features/portfolio/spec';
import { profitLossSpec } from '@/features/profit-loss/spec';
import { quotesSpec } from '@/features/quotes/spec';
import { recurringInvoicesSpec } from '@/features/recurring-invoices/spec';
import { skillsSpec } from '@/features/skills/spec';
import type { PlannedSpec } from './types';

/**
 * Every piece that is described but not built, in the suggested build order. Money in cents comes first because
 * the pieces after it store or read money; Allocation, Skills and Portfolio touch no money and can move earlier.
 * When a piece is built, delete its spec.ts, skeleton page and dialog previews, build the real ones in the same
 * folder, and remove the piece from this list and from the routes under `planned` in app.tsx.
 */
export const PLANNED: PlannedSpec[] = [
  moneyInCentsSpec,
  currencyTaxSpec,
  milestonesSpec,
  recurringInvoicesSpec,
  allocationSpec,
  skillsSpec,
  cashFlowSpec,
  profitLossSpec,
  quotesSpec,
  portfolioSpec,
];
