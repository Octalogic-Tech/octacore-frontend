import { allocationSpec } from '@/features/allocation/spec';
import { cashFlowSpec } from '@/features/cash-flow/spec';
import { currencyTaxSpec } from '@/features/currency-tax/spec';
import { milestonesSpec } from '@/features/milestones/spec';
import { portfolioSpec } from '@/features/portfolio/spec';
import { profitLossSpec } from '@/features/profit-loss/spec';
import { quotesSpec } from '@/features/quotes/spec';
import { recurringInvoicesSpec } from '@/features/recurring-invoices/spec';
import { skillsSpec } from '@/features/skills/spec';
import type { PlannedSpec } from './types';

/**
 * Every piece that is described but not built, in the suggested build order. Currency and tax comes first because
 * Cash flow, Profit and loss and Quotes need it; a piece with no needs (Milestones, Recurring invoices, Allocation,
 * Skills, Portfolio) can move earlier.
 * When a piece is built, delete its spec.ts, skeleton page and dialog previews, build the real ones in the same
 * folder, and remove the piece from this list and from the routes under `planned` in app.tsx.
 */
export const PLANNED: PlannedSpec[] = [
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
