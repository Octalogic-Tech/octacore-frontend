import { toListRows, type InvoiceListRow } from '@/features/invoices/filters';
import type { InvoiceRow, ProjectRow } from '@/features/projects/schema';

const LIST_LENGTH = 5;

export interface OverviewSummary {
  projectCount: number;
  totalValue: number;
  totalOutstanding: number;
  /** Up to five projects, largest outstanding amount first. Settled projects are left out. */
  topOutstanding: ProjectRow[];
  unpaidCount: number;
  /** Up to five unpaid invoices, the one due soonest first. Those with no due date come last. */
  unpaidInvoices: InvoiceListRow[];
}

const sum = (numbers: number[]) => numbers.reduce((total, value) => total + value, 0);

/** Due soonest first; with no due date, last. A tie goes to the older issue, then the earlier entry. */
function dueSoonestFirst(a: InvoiceListRow, b: InvoiceListRow): number {
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  }
  return a.issueDate.localeCompare(b.issueDate) || a.id - b.id;
}

export function summarize(projects: ProjectRow[], invoices: InvoiceRow[]): OverviewSummary {
  const unpaid = toListRows(invoices, projects).filter((invoice) => invoice.paidDate === null);
  return {
    projectCount: projects.length,
    totalValue: sum(projects.map((project) => project.totalValue)),
    totalOutstanding: sum(projects.map((project) => project.totalOutstanding)),
    topOutstanding: projects
      .filter((project) => project.totalOutstanding > 0)
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
      .slice(0, LIST_LENGTH),
    unpaidCount: unpaid.length,
    unpaidInvoices: unpaid.sort(dueSoonestFirst).slice(0, LIST_LENGTH),
  };
}
