import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import { downloadCsv } from '@/lib/csv';
import { invoiceRows, invoicesEnvelope, projectRows, projectsEnvelope } from '@/test/fixtures/projects';
import { renderWithProviders } from '@/test/utils';
import { InvoicesPage } from './invoices-page';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/lib/csv', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/csv')>()),
  downloadCsv: vi.fn(),
}));
// A fixed "today", so what is overdue can be checked against exact dates.
vi.mock('@/lib/format', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/format')>()),
  localToday: () => '2026-11-20',
}));

// The page reads only the client's name from the embedded client.
const globex = { id: 2, name: 'Globex' };

// Website and Legacy portal belong to Acme, Billing to Globex, Mobile app to nobody.
const projects = [...projectRows, { ...projectRows[0], id: 4, name: 'Billing', clientId: 2, client: globex }];

// INV-001 (paid) and INV-002 (unpaid, no due date) are the shared fixtures, both on Website.
const invoices = [
  ...invoiceRows,
  { ...invoiceRows[1], id: 3, projectId: 2, number: 'INV-003', amount: 8000, issueDate: '2026-10-20', dueDate: '2026-11-10' },
  { ...invoiceRows[1], id: 4, projectId: 3, number: 'INV-004', amount: 5000, issueDate: '2026-11-15', dueDate: '2026-12-01' },
  { ...invoiceRows[0], id: 5, projectId: 4, number: 'INV-005', amount: 2000, issueDate: '2026-09-15', dueDate: '2026-10-15', paidDate: '2026-10-01' },
];

function serve(opts: { invoices?: unknown; projects?: unknown; fail?: '/invoices' | '/projects' } = {}) {
  vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
    if (path === opts.fail) throw new Error('down');
    if (path === '/invoices') return { data: invoicesEnvelope(opts.invoices ?? invoices) };
    if (path === '/projects') return { data: projectsEnvelope(opts.projects ?? projects) };
    throw new Error(`unexpected GET ${path}`);
  }) as never);
}

const dataRows = () => screen.getAllByRole('row').slice(1);
const numbers = () => dataRows().map((row) => /INV-\d+/.exec(row.textContent ?? '')?.[0]);
const rowFor = (number: string) => screen.getByText(number).closest('tr') as HTMLElement;

/** Waits for the table, then returns the person's way of choosing from a filter. */
async function renderLoaded() {
  const user = userEvent.setup();
  renderWithProviders(<InvoicesPage />);
  await screen.findByText('INV-002');
  return user;
}

beforeEach(() => {
  serve();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('InvoicesPage: reading', () => {
  it("asks for every project's invoices, not one project's, and for the projects", async () => {
    await renderLoaded();
    expect(coreApi.get).toHaveBeenCalledWith('/projects');
    const asked = vi.mocked(coreApi.get).mock.calls.filter(([path]) => path === '/invoices');
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.every((call) => call.length === 1)).toBe(true);
  });

  it('is headed Invoices and has no add button: invoices are added from a project', async () => {
    await renderLoaded();
    expect(screen.getByRole('heading', { level: 1, name: 'Invoices' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add/i })).not.toBeInTheDocument();
  });

  it('lists the unpaid invoices, overdue ones included, newest issued first, by default', async () => {
    await renderLoaded();
    expect(screen.getByLabelText('Status')).toHaveValue('active');
    expect(numbers()).toEqual(['INV-004', 'INV-002', 'INV-003']);
  });

  it('shows an invoice with its client, project, dates, amount and status', async () => {
    await renderLoaded();
    const row = within(rowFor('INV-003'));
    expect(row.getByRole('link', { name: 'Mobile app' })).toHaveAttribute('href', '/projects/2');
    expect(row.getByText('20 Oct 2026')).toBeInTheDocument();
    expect(row.getByText('10 Nov 2026')).toBeInTheDocument();
    expect(row.getByText('$8,000')).toBeInTheDocument();
    expect(row.getByText('Overdue')).toBeInTheDocument();
    // No client on the project, so a dash in its place.
    expect(row.getByText('—')).toBeInTheDocument();
  });

  it('shows the client, a dash for no due date, and Unpaid for an invoice not yet due', async () => {
    await renderLoaded();
    const row = within(rowFor('INV-002'));
    expect(row.getByText('Acme')).toBeInTheDocument();
    expect(row.getByText('—')).toBeInTheDocument();
    expect(row.getByText('Unpaid')).toBeInTheDocument();
  });
});

describe('InvoicesPage: status', () => {
  it('shows paid invoices with the day they were paid', async () => {
    const user = await renderLoaded();
    await user.selectOptions(screen.getByLabelText('Status'), 'Paid');
    expect(numbers()).toEqual(['INV-001', 'INV-005']);
    expect(within(rowFor('INV-001')).getByText('Paid 12 Oct 2026')).toBeInTheDocument();
  });

  it('shows only the overdue ones', async () => {
    const user = await renderLoaded();
    await user.selectOptions(screen.getByLabelText('Status'), 'Overdue');
    expect(numbers()).toEqual(['INV-003']);
  });

  it('shows everything', async () => {
    const user = await renderLoaded();
    await user.selectOptions(screen.getByLabelText('Status'), 'All');
    expect(numbers()).toEqual(['INV-004', 'INV-002', 'INV-003', 'INV-001', 'INV-005']);
  });
});

describe('InvoicesPage: client and project', () => {
  it("filters by client, and offers only that client's projects", async () => {
    const user = await renderLoaded();
    await user.selectOptions(screen.getByLabelText('Status'), 'All');
    await user.selectOptions(screen.getByLabelText('Client'), 'Acme');
    expect(numbers()).toEqual(['INV-004', 'INV-002', 'INV-001']);
    const offered = within(screen.getByLabelText('Project')).getAllByRole('option').map((option) => option.textContent);
    expect(offered).toEqual(['All projects', 'Legacy portal', 'Website']);
  });

  it('lists the clients that have projects, by name', async () => {
    await renderLoaded();
    const offered = within(screen.getByLabelText('Client')).getAllByRole('option').map((option) => option.textContent);
    expect(offered).toEqual(['All clients', 'Acme', 'Globex']);
  });

  it('filters by project', async () => {
    const user = await renderLoaded();
    await user.selectOptions(screen.getByLabelText('Status'), 'All');
    await user.selectOptions(screen.getByLabelText('Project'), 'Billing');
    expect(numbers()).toEqual(['INV-005']);
  });

  it('lets go of a chosen project when another client is chosen, so the list is not left empty', async () => {
    const user = await renderLoaded();
    await user.selectOptions(screen.getByLabelText('Status'), 'All');
    await user.selectOptions(screen.getByLabelText('Project'), 'Website');
    expect(numbers()).toEqual(['INV-002', 'INV-001']);
    await user.selectOptions(screen.getByLabelText('Client'), 'Globex');
    expect(screen.getByLabelText('Project')).toHaveValue('');
    expect(numbers()).toEqual(['INV-005']);
  });

  it("keeps a chosen project when its own client is chosen", async () => {
    const user = await renderLoaded();
    await user.selectOptions(screen.getByLabelText('Status'), 'All');
    await user.selectOptions(screen.getByLabelText('Project'), 'Website');
    await user.selectOptions(screen.getByLabelText('Client'), 'Acme');
    expect(screen.getByLabelText('Project')).toHaveValue('1');
    expect(numbers()).toEqual(['INV-002', 'INV-001']);
  });
});

describe('InvoicesPage: dates', () => {
  it('filters on the issue date with both bounds included', async () => {
    const user = await renderLoaded();
    await user.selectOptions(screen.getByLabelText('Status'), 'All');
    fireEvent.change(screen.getByLabelText('Issued from'), { target: { value: '2026-10-20' } });
    expect(numbers()).toEqual(['INV-004', 'INV-002', 'INV-003']);
    fireEvent.change(screen.getByLabelText('Issued to'), { target: { value: '2026-11-01' } });
    expect(numbers()).toEqual(['INV-002', 'INV-003']);
  });

  it('says when the range is inverted, shows no rows and disables the export', async () => {
    await renderLoaded();
    fireEvent.change(screen.getByLabelText('Issued from'), { target: { value: '2026-11-10' } });
    fireEvent.change(screen.getByLabelText('Issued to'), { target: { value: '2026-10-01' } });
    expect(screen.getByRole('alert')).toHaveTextContent('The start date is after the end date.');
    expect(screen.getByText('No invoices match these filters.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  });
});

describe('InvoicesPage: clearing and exporting', () => {
  it('offers to clear the filters only once one differs from the default, and clearing brings back the active invoices', async () => {
    const user = await renderLoaded();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Status'), 'All');
    await user.selectOptions(screen.getByLabelText('Client'), 'Globex');
    expect(numbers()).toEqual(['INV-005']);
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByLabelText('Status')).toHaveValue('active');
    expect(screen.getByLabelText('Client')).toHaveValue('');
    expect(numbers()).toEqual(['INV-004', 'INV-002', 'INV-003']);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('exports exactly the rows that are shown', async () => {
    const user = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const [filename, csv] = vi.mocked(downloadCsv).mock.calls[0];
    expect(filename).toBe('invoices.csv');
    expect(csv).toContain('INV-002');
    expect(csv).toContain('INV-003,,Mobile app,2026-10-20,2026-11-10,,8000,Overdue');
    expect(csv).toContain('INV-004');
    expect(csv).not.toContain('INV-001');
    expect(csv).not.toContain('INV-005');
  });
});

describe('InvoicesPage: paging', () => {
  it('goes back to the first page when a filter changes', async () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      ...invoiceRows[1],
      id: 100 + index,
      number: `INV-${100 + index}`,
      issueDate: `2026-11-${String(index + 1).padStart(2, '0')}`,
    }));
    serve({ invoices: many });
    const user = userEvent.setup();
    renderWithProviders(<InvoicesPage />);
    await screen.findByText('INV-111');
    expect(screen.getByText('1–10 of 12')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('11–12 of 12')).toBeInTheDocument();
    // This bound drops nothing, so only the return to page one can explain the pager moving.
    fireEvent.change(screen.getByLabelText('Issued from'), { target: { value: '2026-01-01' } });
    expect(screen.getByText('1–10 of 12')).toBeInTheDocument();
  });
});

describe('InvoicesPage: states', () => {
  it('says so, and points to the projects, when there are no invoices at all', async () => {
    serve({ invoices: [] });
    renderWithProviders(<InvoicesPage />);
    expect(await screen.findByText('No invoices yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open a project to add one' })).toHaveAttribute('href', '/projects');
  });

  it('says when the filters leave nothing, for instance when every invoice is paid', async () => {
    serve({ invoices: [invoiceRows[0]] });
    renderWithProviders(<InvoicesPage />);
    expect(await screen.findByText('No invoices match these filters.')).toBeInTheDocument();
  });

  it.each(['/invoices', '/projects'] as const)('shows an error with a retry when %s cannot be loaded', async (path) => {
    serve({ fail: path });
    renderWithProviders(<InvoicesPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
