import type { Bill } from '@/features/bills/types';
import type { ProjectRow } from '@/features/projects/schema';

const LIST_LENGTH = 5;

export interface OverviewSummary {
  projectCount: number;
  totalValue: number;
  totalOutstanding: number;
  /** Up to five projects, largest outstanding amount first. Settled projects are left out. */
  topOutstanding: ProjectRow[];
  pendingCount: number;
  /** Up to five pending bills, newest first. */
  pendingBills: Bill[];
}

const sum = (numbers: number[]) => numbers.reduce((total, value) => total + value, 0);

export function summarize(projects: ProjectRow[], bills: Bill[]): OverviewSummary {
  const pending = bills.filter((bill) => !bill.approved);
  return {
    projectCount: projects.length,
    totalValue: sum(projects.map((project) => project.totalValue)),
    totalOutstanding: sum(projects.map((project) => project.totalOutstanding)),
    topOutstanding: projects
      .filter((project) => project.totalOutstanding > 0)
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
      .slice(0, LIST_LENGTH),
    pendingCount: pending.length,
    pendingBills: [...pending].sort((a, b) => b.billDate.localeCompare(a.billDate)).slice(0, LIST_LENGTH),
  };
}
