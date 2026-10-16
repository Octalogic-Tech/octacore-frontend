import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import { envelope } from '@/test/fake-adapter';
import { renderWithProviders } from '@/test/utils';
import { OverviewPage } from './overview-page';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

// Projects and invoices come from the core service, with the totals already calculated.
const project = (id: number, clientName: string, totalValue: number, totalOutstanding: number) => ({
  id,
  name: `Project ${id}`,
  description: null,
  key: null,
  billingAddress: null,
  discountPercent: 0,
  projectStatus: 'active',
  startDate: null,
  endDate: null,
  clientId: id,
  client: { name: clientName },
  projectType: 'product',
  billingType: 'retainer',
  totalValue,
  totalOutstanding,
});

const projects = [
  project(1, 'Client A', 48000, 12000),
  project(2, 'Client B', 32000, 0),
  project(3, 'Client C', 20000, 25000),
];

const invoice = (id: number, projectId: number, dueDate: string | null, paidDate: string | null) => ({
  id,
  projectId,
  number: `INV-00${id}`,
  description: null,
  subtotal: 1000 * id,
  discountPercent: 0,
  amount: 1000 * id,
  issueDate: '2026-10-01',
  dueDate,
  paidDate,
  periodStart: null,
  periodEnd: null,
  lineItems: [],
});

// INV-001 is paid. Of the other two, INV-003 falls due first, though INV-002 was entered first.
const invoices = [
  invoice(1, 1, '2026-10-31', '2026-10-12'),
  invoice(2, 1, '2026-12-15', null),
  invoice(3, 3, '2026-11-20', null),
];

function serve(data: { projects?: unknown[]; invoices?: unknown[] }) {
  vi.mocked(coreApi.get).mockImplementation((async (url: string) => {
    if (url === '/projects') return { data: envelope(data.projects ?? projects) };
    if (url === '/invoices') return { data: envelope(data.invoices ?? invoices) };
    throw new Error(`unexpected GET ${url}`);
  }) as never);
}

const sentence = (expected: string) => (_: string, element: Element | null) =>
  element?.tagName === 'P' && element.textContent === expected;

afterEach(() => {
  vi.resetAllMocks();
});

describe('OverviewPage', () => {
  it('says what is outstanding and how many invoices are unpaid, from the data', async () => {
    serve({});
    renderWithProviders(<OverviewPage />);
    expect(
      await screen.findByText(sentence('$37,000 outstanding across 3 projects, of $100,000 in total.')),
    ).toBeInTheDocument();
    expect(screen.getByText(sentence('2 invoices are unpaid.'))).toBeInTheDocument();
  });

  it('uses the singular for one project and one invoice', async () => {
    serve({ projects: [projects[0]], invoices: [invoice(1, 1, null, null)] });
    renderWithProviders(<OverviewPage />);
    expect(
      await screen.findByText(sentence('$12,000 outstanding across 1 project, of $48,000 in total.')),
    ).toBeInTheDocument();
    expect(screen.getByText(sentence('1 invoice is unpaid.'))).toBeInTheDocument();
  });

  it('says so when every invoice is paid', async () => {
    serve({ invoices: [invoice(1, 1, '2026-10-31', '2026-10-12')] });
    renderWithProviders(<OverviewPage />);
    expect(await screen.findByText('No invoices are unpaid.')).toBeInTheDocument();
  });

  it('lists the largest outstanding projects and the unpaid invoices, the one due soonest first', async () => {
    serve({});
    renderWithProviders(<OverviewPage />);
    const largest = (await screen.findByRole('heading', { name: 'Largest outstanding' })).closest('section') as HTMLElement;
    const items = within(largest).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Project 3')).toBeInTheDocument();
    expect(within(items[0]).getByText('$25,000')).toBeInTheDocument();
    expect(within(items[1]).getByText('Project 1')).toBeInTheDocument();

    const unpaid = screen.getByRole('heading', { name: 'Unpaid invoices' }).closest('section') as HTMLElement;
    const rows = within(unpaid).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('INV-003')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Project 3, due 20 Nov 2026')).toBeInTheDocument();
    expect(within(rows[0]).getByText('$3,000')).toBeInTheDocument();
    expect(within(rows[1]).getByText('INV-002')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Project 1, due 15 Dec 2026')).toBeInTheDocument();
  });

  it('says when an unpaid invoice has no due date', async () => {
    serve({ invoices: [invoice(1, 1, null, null)] });
    renderWithProviders(<OverviewPage />);
    expect(await screen.findByText('Project 1, no due date')).toBeInTheDocument();
  });

  it('links on to the pages that hold the detail', async () => {
    serve({});
    renderWithProviders(<OverviewPage />);
    expect(await screen.findByRole('link', { name: 'All projects' })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('link', { name: 'Review invoices' })).toHaveAttribute('href', '/finance/invoices');
  });

  it('shows an error with a retry when either request fails', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    renderWithProviders(<OverviewPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    serve({});
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(sentence('2 invoices are unpaid.'))).toBeInTheDocument();
  });

  it('copes with no projects and no invoices', async () => {
    serve({ projects: [], invoices: [] });
    renderWithProviders(<OverviewPage />);
    expect(await screen.findByText(sentence('$0 outstanding across 0 projects, of $0 in total.'))).toBeInTheDocument();
    expect(screen.getByText('Nothing is outstanding.')).toBeInTheDocument();
    expect(screen.getByText('No invoices are unpaid.', { selector: 'p.text-statement' })).toBeInTheDocument();
    expect(screen.getByText('Nothing is unpaid.')).toBeInTheDocument();
  });
});
