import { sortInvoices, type InvoiceRow, type ProjectRow } from '@/features/projects/schema';

export type InvoiceStatus = 'paid' | 'overdue' | 'unpaid';

export const STATUS_LABELS: Record<InvoiceStatus, string> = { paid: 'Paid', overdue: 'Overdue', unpaid: 'Unpaid' };

/** `active` is every invoice not yet paid, overdue ones included. */
export type StatusFilter = 'active' | 'overdue' | 'paid' | 'all';

export interface InvoiceFilters {
  status: StatusFilter;
  clientId: number | null;
  projectId: number | null;
  /** `YYYY-MM-DD`, compared with the issue date. Empty is no bound. */
  from: string;
  to: string;
}

export const defaultFilters: InvoiceFilters = { status: 'active', clientId: null, projectId: null, from: '', to: '' };

/** An invoice with the names it is listed under. The service gives it only its project's id. */
export interface InvoiceListRow extends InvoiceRow {
  projectName: string;
  clientId: number | null;
  clientName: string;
}

export interface Option {
  id: number;
  name: string;
}

/** Dates are `YYYY-MM-DD`, so string comparison is date comparison and no time zone gets involved. */
export function invoiceStatus({ paidDate, dueDate }: Pick<InvoiceRow, 'paidDate' | 'dueDate'>, today: string): InvoiceStatus {
  if (paidDate) return 'paid';
  return dueDate && dueDate < today ? 'overdue' : 'unpaid';
}

/**
 * Newest first, each with its project's name and client. An invoice whose project is not in the list keeps blank
 * names rather than being dropped: the two lists are fetched separately and can disagree for a moment.
 */
export function toListRows(invoices: readonly InvoiceRow[], projects: readonly ProjectRow[]): InvoiceListRow[] {
  const byId = new Map(projects.map((project) => [project.id, project]));
  return sortInvoices(invoices).map((invoice) => {
    const project = byId.get(invoice.projectId);
    return {
      ...invoice,
      projectName: project?.name ?? '',
      clientId: project?.clientId ?? null,
      clientName: project?.clientName ?? '',
    };
  });
}

const byName = (a: Option, b: Option) => a.name.localeCompare(b.name);

/**
 * The clients that have a project. A client with none cannot have an invoice. A deleted client leaves its projects
 * with an id and no name: there is nothing to show for it, so it is not offered.
 */
export function clientOptions(projects: readonly ProjectRow[]): Option[] {
  const clients = new Map<number, Option>();
  for (const { clientId, clientName } of projects) {
    if (clientId !== null && clientName !== '') clients.set(clientId, { id: clientId, name: clientName });
  }
  return [...clients.values()].sort(byName);
}

/** Every project, or only the chosen client's. */
export function projectOptions(projects: readonly ProjectRow[], clientId: number | null): Option[] {
  return projects
    .filter((project) => clientId === null || project.clientId === clientId)
    .map(({ id, name }) => ({ id, name }))
    .sort(byName);
}

function matchesStatus(status: InvoiceStatus, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'active') return status !== 'paid';
  return status === filter;
}

/** Keeps the order it is given. An inverted range matches nothing, because no date is both after `from` and before `to`. */
export function filterInvoices(
  rows: readonly InvoiceListRow[],
  { status, clientId, projectId, from, to }: InvoiceFilters,
  today: string,
): InvoiceListRow[] {
  return rows.filter((row) => {
    if (clientId !== null && row.clientId !== clientId) return false;
    if (projectId !== null && row.projectId !== projectId) return false;
    if (from && row.issueDate < from) return false;
    if (to && row.issueDate > to) return false;
    return matchesStatus(invoiceStatus(row, today), status);
  });
}

export function isRangeInverted({ from, to }: Pick<InvoiceFilters, 'from' | 'to'>): boolean {
  return Boolean(from && to && from > to);
}

export function isDefaultFilters(filters: InvoiceFilters): boolean {
  return (Object.keys(defaultFilters) as (keyof InvoiceFilters)[]).every((key) => filters[key] === defaultFilters[key]);
}
