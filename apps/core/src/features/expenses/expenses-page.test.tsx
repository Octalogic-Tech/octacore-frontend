import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import { downloadCsv } from '@/lib/csv';
import {
  answering,
  currencyRows,
  expenseRows,
  expenseTypeRows,
  expensesEnvelope,
  recurringRows,
  summaryData,
} from '@/test/fixtures/expenses';
import { projectRows } from '@/test/fixtures/projects';
import { renderWithProviders } from '@/test/utils';
import { ExpensesPage } from './expenses-page';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/lib/csv', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/csv')>()),
  downloadCsv: vi.fn(),
}));

const answers = {
  '/expenses': expenseRows,
  '/expenses/summary': summaryData,
  '/expense-types': expenseTypeRows,
  '/projects': projectRows,
  '/currencies': currencyRows,
  '/recurring-expenses': recurringRows,
};

const YEAR = { from: '2026-01-01', to: '2026-12-31' };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 16, 12));
  vi.mocked(coreApi.get).mockImplementation(answering(answers));
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe('ExpensesPage', () => {
  it('asks for this year’s expenses and their summary, and for the strip’s own summary', async () => {
    renderWithProviders(<ExpensesPage />);
    await screen.findByText('Co-working desk');
    expect(coreApi.get).toHaveBeenCalledWith('/expenses', { params: YEAR });
    expect(coreApi.get).toHaveBeenCalledWith('/expenses/summary', { params: YEAR });
    expect(coreApi.get).toHaveBeenCalledWith('/expenses/summary', { params: { from: '2025-01-01', to: '2026-10-16' } });
  });

  it('lists each expense with its date, type, project and dollar amount', async () => {
    renderWithProviders(<ExpensesPage />);
    const figma = (await screen.findByText('Figma')).closest('tr') as HTMLElement;
    expect(within(figma).getByText('1 Oct 2026')).toBeInTheDocument();
    expect(within(figma).getByText('Software subscription')).toBeInTheDocument();
    expect(within(figma).getByText('$15.00')).toBeInTheDocument();
    const desk = screen.getByText('Co-working desk').closest('tr') as HTMLElement;
    expect(within(desk).getByText('Website')).toBeInTheDocument();
    expect(within(desk).getByText('$100.00')).toBeInTheDocument();
  });

  it('tags an expense a recurring expense made, and shows a rupee charge’s original amount and rate', async () => {
    renderWithProviders(<ExpensesPage />);
    const figma = (await screen.findByText('Figma')).closest('tr') as HTMLElement;
    expect(within(figma).getByText('Recurring')).toBeInTheDocument();
    const desk = screen.getByText('Co-working desk').closest('tr') as HTMLElement;
    expect(within(desk).queryByText('Recurring')).not.toBeInTheDocument();
    expect(within(desk).getByText('₹8,825.00 at 88.25')).toBeInTheDocument();
  });

  it('shows the total of the rows, and the total by type', async () => {
    renderWithProviders(<ExpensesPage />);
    expect(await screen.findByText('2 expenses · $115.00')).toBeInTheDocument();
    const byType = screen.getByRole('region', { name: 'By type' });
    expect(within(byType).getByText('Travel')).toBeInTheDocument();
    expect(within(byType).getByText('$100.00')).toBeInTheDocument();
    expect(within(byType).getByText('Software subscription')).toBeInTheDocument();
  });

  it('shows this month, last month, the year so far and the monthly recurring cost', async () => {
    renderWithProviders(<ExpensesPage />);
    const strip = await screen.findByLabelText('Spend at a glance');
    await waitFor(() => expect(within(strip).getByText('This month').nextSibling).toHaveTextContent('$15.00'));
    expect(within(strip).getByText('Last month').nextSibling).toHaveTextContent('$100.00');
    expect(within(strip).getByText('Year to date').nextSibling).toHaveTextContent('$115.00');
    expect(within(strip).getByText('Recurring per month').nextSibling).toHaveTextContent('$15.00');
  });

  it('narrows by type, by source and by a search', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExpensesPage />);
    await screen.findByText('Figma');
    await user.selectOptions(screen.getByLabelText('Type'), '2');
    await waitFor(() =>
      expect(coreApi.get).toHaveBeenCalledWith('/expenses', { params: { ...YEAR, expenseTypeId: 2 } }),
    );
    await user.selectOptions(screen.getByLabelText('Source'), 'recurring');
    await waitFor(() =>
      expect(coreApi.get).toHaveBeenCalledWith('/expenses', {
        params: { ...YEAR, expenseTypeId: 2, recurring: true },
      }),
    );
    await user.selectOptions(screen.getByLabelText('Source'), 'one-time');
    await waitFor(() =>
      expect(coreApi.get).toHaveBeenCalledWith('/expenses', {
        params: { ...YEAR, expenseTypeId: 2, recurring: false },
      }),
    );
    await user.type(screen.getByLabelText('Search expenses'), 'fig');
    await waitFor(() =>
      expect(coreApi.get).toHaveBeenCalledWith('/expenses', {
        params: { ...YEAR, expenseTypeId: 2, recurring: false, q: 'fig' },
      }),
    );
  });

  it('narrows by project and by date, and the summary follows the same filters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExpensesPage />);
    await screen.findByText('Figma');
    await user.selectOptions(screen.getByLabelText('Project'), '1');
    fireEvent.change(screen.getByLabelText('Charged from'), { target: { value: '2026-09-01' } });
    const narrowed = { projectId: 1, from: '2026-09-01', to: '2026-12-31' };
    await waitFor(() => expect(coreApi.get).toHaveBeenCalledWith('/expenses', { params: narrowed }));
    expect(coreApi.get).toHaveBeenCalledWith('/expenses/summary', { params: narrowed });
  });

  it('clears the filters back to this year', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExpensesPage />);
    await screen.findByText('Figma');
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Type'), '2');
    await user.click(await screen.findByRole('button', { name: 'Clear filters' }));
    expect(screen.getByLabelText('Type')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('says when the start date is after the end date', async () => {
    renderWithProviders(<ExpensesPage />);
    await screen.findByText('Figma');
    fireEvent.change(screen.getByLabelText('Charged from'), { target: { value: '2026-12-31' } });
    fireEvent.change(screen.getByLabelText('Charged to'), { target: { value: '2026-01-01' } });
    expect(await screen.findByText('The start date is after the end date.')).toBeInTheDocument();
  });

  it('exports the rows shown as a CSV file', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExpensesPage />);
    await screen.findByText('Figma');
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(downloadCsv).toHaveBeenCalledWith('expenses.csv', expect.stringContaining('Co-working desk'));
    expect(vi.mocked(downloadCsv).mock.calls[0][1]).toContain('Date,Name,Type,Project,Source,Amount (USD)');
  });

  it('opens the new expense dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExpensesPage />);
    await screen.findByText('Figma');
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    expect(screen.getByRole('dialog', { name: 'New expense' })).toBeInTheDocument();
  });

  it('opens an expense to edit, named by its date because charges can repeat a name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExpensesPage />);
    await user.click(await screen.findByRole('button', { name: 'Edit Figma, 1 Oct 2026' }));
    expect(screen.getByRole('dialog', { name: 'Edit expense' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Figma');
  });

  it('deletes an expense after the confirmation, warning that a generated charge does not come back', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue({ data: expensesEnvelope({}) });
    const user = userEvent.setup();
    renderWithProviders(<ExpensesPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete Figma, 1 Oct 2026' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('The charge is not created again.');
    await user.click(screen.getByRole('button', { name: 'Delete expense' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/expenses/1'));
  });

  it('invites the first expense when there are none and no filter is set', async () => {
    vi.mocked(coreApi.get).mockImplementation(answering({ ...answers, '/expenses': [] }));
    renderWithProviders(<ExpensesPage />);
    expect(await screen.findByText('No expenses yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  });

  it('says nothing matches when a filter leaves no expenses', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExpensesPage />);
    await screen.findByText('Figma');
    vi.mocked(coreApi.get).mockImplementation(answering({ ...answers, '/expenses': [] }));
    await user.selectOptions(screen.getByLabelText('Type'), '2');
    expect(await screen.findByText('No expenses match these filters.')).toBeInTheDocument();
  });

  it('offers a way to try again when the service is down', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(new Error('down'));
    renderWithProviders(<ExpensesPage />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('still lists the expenses when only the summary fails', async () => {
    vi.mocked(coreApi.get).mockImplementation(async (url: string) => {
      if (url === '/expenses/summary') throw new Error('down');
      return answering(answers)(url);
    });
    renderWithProviders(<ExpensesPage />);
    expect(await screen.findByText('Co-working desk')).toBeInTheDocument();
    expect(screen.queryByText(/expenses · /)).not.toBeInTheDocument();
  });
});
