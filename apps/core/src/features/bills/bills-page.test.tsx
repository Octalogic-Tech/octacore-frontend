import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@/lib/api';
import { renderWithProviders } from '@/test/utils';
import { BillsPage } from './bills-page';
import { downloadCsv } from './csv';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('./csv', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./csv')>()),
  downloadCsv: vi.fn(),
}));

const bills = [
  { id: 1, billDate: '2023-08-08', amount: 50, billType: 'Bonus', actualExpense: false, billPath: '/p/1', uploadedBy: 'Asha', submittedBy: 'Asha', approved: true, approvedBy: 'Manager' },
  { id: 2, billDate: '2023-08-09', amount: 200, billType: 'Regular', actualExpense: true, billPath: '/p/2', uploadedBy: 'Ben', submittedBy: 'Ben', approved: false, approvedBy: '' },
  { id: 3, billDate: '2023-08-10', amount: 100.5, billType: 'Incentive', actualExpense: false, billPath: '/p/3', uploadedBy: 'Chen', submittedBy: 'Chen', approved: true, approvedBy: 'Manager' },
];

beforeEach(() => {
  vi.mocked(api.get).mockResolvedValue({ data: bills });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('BillsPage', () => {
  it('lists the newest bill first with formatted amounts and a status for each', async () => {
    renderWithProviders(<BillsPage />);
    await screen.findByText('Chen');
    const dataRows = screen.getAllByRole('row').slice(1);
    expect(dataRows).toHaveLength(3);
    expect(within(dataRows[0]).getByText('Chen')).toBeInTheDocument();
    expect(within(dataRows[0]).getByText('$100.50')).toBeInTheDocument();
    expect(within(dataRows[0]).getByText('10 Aug 2023')).toBeInTheDocument();
    expect(within(dataRows[1]).getByText('Pending')).toBeInTheDocument();
    expect(within(dataRows[1]).getByText('Yes')).toBeInTheDocument();
    expect(within(dataRows[2]).getByText('Approved')).toBeInTheDocument();
  });

  it('filters by approval', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BillsPage />);
    await screen.findByText('Chen');
    await user.selectOptions(screen.getByLabelText('Approval'), 'pending');
    expect(screen.getByText('Ben')).toBeInTheDocument();
    expect(screen.queryByText('Chen')).not.toBeInTheDocument();
    expect(screen.queryByText('Asha')).not.toBeInTheDocument();
  });

  it('filters by date range with both bounds included', async () => {
    renderWithProviders(<BillsPage />);
    await screen.findByText('Chen');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2023-08-09' } });
    expect(screen.queryByText('Asha')).not.toBeInTheDocument();
    expect(screen.getByText('Ben')).toBeInTheDocument();
    expect(screen.getByText('Chen')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2023-08-09' } });
    expect(screen.getByText('Ben')).toBeInTheDocument();
    expect(screen.queryByText('Chen')).not.toBeInTheDocument();
  });

  it('says when the range is inverted, shows no rows and disables the export', async () => {
    renderWithProviders(<BillsPage />);
    await screen.findByText('Chen');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2023-08-10' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2023-08-08' } });
    expect(screen.getByRole('alert')).toHaveTextContent('From date is after To date.');
    expect(screen.getByText('No bills match these filters.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  });

  it('exports exactly the rows that are shown', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BillsPage />);
    await screen.findByText('Chen');
    await user.selectOptions(screen.getByLabelText('Approval'), 'approved');
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const [filename, csv] = vi.mocked(downloadCsv).mock.calls[0];
    expect(filename).toBe('receipts-and-bills.csv');
    expect(csv).toContain('Asha');
    expect(csv).toContain('Chen');
    expect(csv).not.toContain('Ben');
  });

  it('clears the filters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BillsPage />);
    await screen.findByText('Chen');
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Approval'), 'pending');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(3);
  });

  it('opens the add dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BillsPage />);
    await user.click(await screen.findByRole('button', { name: 'Add bill' }));
    expect(screen.getByRole('dialog', { name: 'Add bill' })).toBeInTheDocument();
  });

  it('shows an error with a retry when the API is down', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('down'));
    renderWithProviders(<BillsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('says so when there are no bills', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    renderWithProviders(<BillsPage />);
    expect(await screen.findByText('No bills yet.')).toBeInTheDocument();
  });
});
