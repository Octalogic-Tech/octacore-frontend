import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@/lib/api';
import { renderWithProviders } from '@/test/utils';
import { OverviewPage } from './overview-page';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const projects = [
  { id: 1, name: 'Project 1', description: '', client: 'Client A', totalValue: 48000, totalOutstanding: 12000 },
  { id: 2, name: 'Project 2', description: '', client: 'Client B', totalValue: 32000, totalOutstanding: 0 },
  { id: 3, name: 'Project 3', description: '', client: 'Client C', totalValue: 20000, totalOutstanding: 25000 },
];

const bill = (id: number, billDate: string, approved: boolean, uploadedBy: string) => ({
  id,
  billDate,
  amount: 100,
  billType: 'Regular',
  actualExpense: false,
  billPath: '',
  uploadedBy,
  submittedBy: uploadedBy,
  approved,
  approvedBy: approved ? 'Manager' : '',
});

const bills = [bill(1, '2023-08-08', true, 'Asha'), bill(2, '2023-08-09', false, 'Ben'), bill(3, '2023-08-10', false, 'Chen')];

function serve(data: { projects?: unknown[]; bills?: unknown[] }) {
  vi.mocked(api.get).mockImplementation((async (url: string) => ({
    data: url === '/projects' ? (data.projects ?? projects) : (data.bills ?? bills),
  })) as never);
}

const sentence = (expected: string) => (_: string, element: Element | null) =>
  element?.tagName === 'P' && element.textContent === expected;

afterEach(() => {
  vi.resetAllMocks();
});

describe('OverviewPage', () => {
  it('says what is outstanding and what waits for approval, from the data', async () => {
    serve({});
    renderWithProviders(<OverviewPage />);
    expect(
      await screen.findByText(sentence('$37,000 outstanding across 3 projects, of $100,000 in total.')),
    ).toBeInTheDocument();
    expect(screen.getByText(sentence('2 bills are waiting for approval.'))).toBeInTheDocument();
  });

  it('uses the singular for one project and one bill', async () => {
    serve({
      projects: [projects[0]],
      bills: [bill(1, '2023-08-08', false, 'Asha')],
    });
    renderWithProviders(<OverviewPage />);
    expect(
      await screen.findByText(sentence('$12,000 outstanding across 1 project, of $48,000 in total.')),
    ).toBeInTheDocument();
    expect(screen.getByText(sentence('1 bill is waiting for approval.'))).toBeInTheDocument();
  });

  it('says so when nothing waits for approval', async () => {
    serve({ bills: [bill(1, '2023-08-08', true, 'Asha')] });
    renderWithProviders(<OverviewPage />);
    expect(await screen.findByText('No bills are waiting for approval.')).toBeInTheDocument();
  });

  it('lists the largest outstanding projects and the pending bills, newest first', async () => {
    serve({});
    renderWithProviders(<OverviewPage />);
    const largest = (await screen.findByRole('heading', { name: 'Largest outstanding' })).closest('section') as HTMLElement;
    const items = within(largest).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Project 3')).toBeInTheDocument();
    expect(within(items[0]).getByText('$25,000')).toBeInTheDocument();
    expect(within(items[1]).getByText('Project 1')).toBeInTheDocument();

    const waiting = screen.getByRole('heading', { name: 'Awaiting approval' }).closest('section') as HTMLElement;
    const pending = within(waiting).getAllByRole('listitem');
    expect(within(pending[0]).getByText(/Chen/)).toBeInTheDocument();
    expect(within(pending[1]).getByText(/Ben/)).toBeInTheDocument();
  });

  it('links on to the pages that hold the detail', async () => {
    serve({});
    renderWithProviders(<OverviewPage />);
    expect(await screen.findByRole('link', { name: 'All projects' })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('link', { name: 'Review bills' })).toHaveAttribute('href', '/finance/receipts-bills');
  });

  it('shows an error with a retry when either request fails', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    renderWithProviders(<OverviewPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    serve({});
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(sentence('2 bills are waiting for approval.'))).toBeInTheDocument();
  });

  it('copes with no projects and no bills', async () => {
    serve({ projects: [], bills: [] });
    renderWithProviders(<OverviewPage />);
    expect(await screen.findByText(sentence('$0 outstanding across 0 projects, of $0 in total.'))).toBeInTheDocument();
    expect(screen.getByText('Nothing is outstanding.')).toBeInTheDocument();
    expect(screen.getByText('No bills are waiting for approval.', { selector: 'p.text-statement' })).toBeInTheDocument();
  });
});
