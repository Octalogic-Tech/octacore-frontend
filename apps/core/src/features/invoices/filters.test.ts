import type { InvoiceRow, ProjectRow } from '@/features/projects/schema';
import {
  clientOptions,
  defaultFilters,
  filterInvoices,
  invoiceStatus,
  isDefaultFilters,
  isRangeInverted,
  projectOptions,
  toListRows,
  type InvoiceListRow,
} from './filters';

const TODAY = '2026-11-20';

const invoice = (id: number, projectId: number, fields: Partial<InvoiceRow> = {}): InvoiceRow => ({
  id,
  projectId,
  number: `INV-${id}`,
  description: '',
  subtotal: 1000 * id,
  discountPercent: 0,
  amount: 1000 * id,
  issueDate: '2026-11-01',
  dueDate: null,
  paidDate: null,
  periodStart: null,
  periodEnd: null,
  lineItems: [],
  ...fields,
});

const project = (id: number, name: string, client: { id: number; name: string } | null): ProjectRow => ({
  id,
  name,
  description: '',
  key: '',
  billingAddress: '',
  discountPercent: 0,
  clientId: client?.id ?? null,
  projectStatus: 'active',
  projectStatusLabel: 'Active',
  startDate: null,
  endDate: null,
  clientName: client?.name ?? '',
  projectType: null,
  billingType: null,
  projectTypeLabel: '',
  billingTypeLabel: '',
  totalValue: 0,
  totalOutstanding: 0,
});

const acme = { id: 1, name: 'Acme' };
const globex = { id: 2, name: 'Globex' };

const projects = [project(1, 'Website', acme), project(2, 'Mobile app', globex), project(3, 'Portal', acme)];

describe('invoiceStatus', () => {
  it('is paid once there is a paid date, even when the invoice is past due', () => {
    expect(invoiceStatus({ paidDate: '2026-11-12', dueDate: '2026-11-01' }, TODAY)).toBe('paid');
  });

  it('is unpaid with no due date, however old the invoice is', () => {
    expect(invoiceStatus({ paidDate: null, dueDate: null }, TODAY)).toBe('unpaid');
  });

  it('is unpaid up to and including its due date', () => {
    expect(invoiceStatus({ paidDate: null, dueDate: TODAY }, TODAY)).toBe('unpaid');
    expect(invoiceStatus({ paidDate: null, dueDate: '2026-12-01' }, TODAY)).toBe('unpaid');
  });

  it('is overdue from the day after its due date', () => {
    expect(invoiceStatus({ paidDate: null, dueDate: '2026-11-19' }, TODAY)).toBe('overdue');
  });
});

describe('toListRows', () => {
  it('adds the project name and the client of the project', () => {
    const [row] = toListRows([invoice(1, 1)], projects);
    expect(row).toMatchObject({ projectName: 'Website', clientId: 1, clientName: 'Acme' });
  });

  it('puts the newest issue date first, and the later entry first on a tie', () => {
    const rows = toListRows(
      [
        invoice(1, 1, { issueDate: '2026-10-01' }),
        invoice(2, 1, { issueDate: '2026-11-01' }),
        invoice(3, 1, { issueDate: '2026-11-01' }),
      ],
      projects,
    );
    expect(rows.map((row) => row.id)).toEqual([3, 2, 1]);
  });

  it('leaves the lists it is given alone', () => {
    const invoices = [invoice(1, 1, { issueDate: '2026-10-01' }), invoice(2, 1, { issueDate: '2026-11-01' })];
    toListRows(invoices, projects);
    expect(invoices.map((row) => row.id)).toEqual([1, 2]);
  });

  it('has no client for a project without one', () => {
    const [row] = toListRows([invoice(1, 4)], [project(4, 'Internal', null)]);
    expect(row).toMatchObject({ projectName: 'Internal', clientId: null, clientName: '' });
  });

  it('keeps an invoice whose project is not in the list, with blank names', () => {
    const [row] = toListRows([invoice(1, 99)], projects);
    expect(row).toMatchObject({ id: 1, projectName: '', clientId: null, clientName: '' });
  });
});

describe('clientOptions', () => {
  it('lists each client that has a project once, by name', () => {
    expect(clientOptions(projects)).toEqual([
      { id: 1, name: 'Acme' },
      { id: 2, name: 'Globex' },
    ]);
  });

  it('skips projects without a client', () => {
    expect(clientOptions([project(4, 'Internal', null)])).toEqual([]);
  });

  it('skips a client that was deleted: its projects keep the id but have no name to show', () => {
    const orphan = { ...project(4, 'Old job', null), clientId: 7 };
    expect(clientOptions([orphan])).toEqual([]);
  });
});

describe('projectOptions', () => {
  it('lists every project by name when no client is chosen', () => {
    expect(projectOptions(projects, null)).toEqual([
      { id: 2, name: 'Mobile app' },
      { id: 3, name: 'Portal' },
      { id: 1, name: 'Website' },
    ]);
  });

  it("lists only the chosen client's projects", () => {
    expect(projectOptions(projects, 1)).toEqual([
      { id: 3, name: 'Portal' },
      { id: 1, name: 'Website' },
    ]);
  });
});

describe('filterInvoices', () => {
  const rows: InvoiceListRow[] = toListRows(
    [
      invoice(1, 1, { issueDate: '2026-10-01', dueDate: '2026-10-31', paidDate: '2026-10-12' }), // paid
      invoice(2, 1, { issueDate: '2026-11-01' }), // unpaid, no due date
      invoice(3, 2, { issueDate: '2026-10-20', dueDate: '2026-11-10' }), // overdue
      invoice(4, 3, { issueDate: '2026-11-15', dueDate: '2026-12-01' }), // unpaid, not due yet
    ],
    projects,
  );
  const ids = (list: InvoiceListRow[]) => list.map((row) => row.id).sort();
  const all = { ...defaultFilters, status: 'all' as const };

  it('shows only unpaid invoices, overdue ones included, by default', () => {
    expect(ids(filterInvoices(rows, defaultFilters, TODAY))).toEqual([2, 3, 4]);
  });

  it('filters by status', () => {
    expect(ids(filterInvoices(rows, { ...all, status: 'overdue' }, TODAY))).toEqual([3]);
    expect(ids(filterInvoices(rows, { ...all, status: 'paid' }, TODAY))).toEqual([1]);
    expect(ids(filterInvoices(rows, all, TODAY))).toEqual([1, 2, 3, 4]);
  });

  it('filters by client', () => {
    expect(ids(filterInvoices(rows, { ...all, clientId: 1 }, TODAY))).toEqual([1, 2, 4]);
    expect(ids(filterInvoices(rows, { ...all, clientId: 2 }, TODAY))).toEqual([3]);
  });

  it('filters by project', () => {
    expect(ids(filterInvoices(rows, { ...all, projectId: 3 }, TODAY))).toEqual([4]);
  });

  it('includes both date bounds, on the issue date', () => {
    expect(ids(filterInvoices(rows, { ...all, from: '2026-10-20', to: '2026-11-01' }, TODAY))).toEqual([2, 3]);
    expect(ids(filterInvoices(rows, { ...all, from: '2026-11-01', to: '2026-11-01' }, TODAY))).toEqual([2]);
  });

  it('works with only a from date, or only a to date', () => {
    expect(ids(filterInvoices(rows, { ...all, from: '2026-11-01' }, TODAY))).toEqual([2, 4]);
    expect(ids(filterInvoices(rows, { ...all, to: '2026-10-20' }, TODAY))).toEqual([1, 3]);
  });

  it('combines the filters', () => {
    expect(ids(filterInvoices(rows, { ...defaultFilters, clientId: 1, from: '2026-11-10' }, TODAY))).toEqual([4]);
    expect(ids(filterInvoices(rows, { ...all, clientId: 2, projectId: 1 }, TODAY))).toEqual([]);
  });

  it('returns nothing, not everything, for an inverted range', () => {
    expect(filterInvoices(rows, { ...all, from: '2026-11-10', to: '2026-10-01' }, TODAY)).toEqual([]);
  });

  it('keeps the order it is given', () => {
    expect(filterInvoices(rows, all, TODAY).map((row) => row.id)).toEqual(rows.map((row) => row.id));
  });
});

describe('isRangeInverted', () => {
  it('is true only when from is after to', () => {
    expect(isRangeInverted({ from: '2026-11-10', to: '2026-10-01' })).toBe(true);
    expect(isRangeInverted({ from: '2026-10-01', to: '2026-10-01' })).toBe(false);
    expect(isRangeInverted({ from: '2026-10-01', to: '2026-11-10' })).toBe(false);
  });

  it('is false while either bound is empty', () => {
    expect(isRangeInverted({ from: '', to: '2026-10-01' })).toBe(false);
    expect(isRangeInverted({ from: '2026-10-01', to: '' })).toBe(false);
  });
});

describe('isDefaultFilters', () => {
  it('is true for the defaults, which show the active invoices', () => {
    expect(defaultFilters.status).toBe('active');
    expect(isDefaultFilters(defaultFilters)).toBe(true);
  });

  it('is false as soon as any one filter differs', () => {
    expect(isDefaultFilters({ ...defaultFilters, status: 'all' })).toBe(false);
    expect(isDefaultFilters({ ...defaultFilters, clientId: 1 })).toBe(false);
    expect(isDefaultFilters({ ...defaultFilters, projectId: 1 })).toBe(false);
    expect(isDefaultFilters({ ...defaultFilters, from: '2026-10-01' })).toBe(false);
    expect(isDefaultFilters({ ...defaultFilters, to: '2026-10-01' })).toBe(false);
  });
});
