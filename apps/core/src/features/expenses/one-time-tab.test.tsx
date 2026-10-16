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
} from '@/test/fixtures/expenses';
import { personRows } from '@/test/fixtures/people';
import { projectRows } from '@/test/fixtures/projects';
import { renderWithProviders } from '@/test/utils';
import { OneTimeTab } from './one-time-tab';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/lib/csv', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/csv')>()),
  downloadCsv: vi.fn(),
}));

// The service answers this tab with one-time expenses only: the rupee desk, for Ada, on the Website project.
const answers = {
  '/expenses': [expenseRows[1]],
  '/expense-types': expenseTypeRows,
  '/projects': projectRows,
  '/currencies': currencyRows,
  '/people': personRows,
};

const YEAR = { from: '2026-01-01', to: '2026-12-31', recurring: false };
const EDIT_DESK = /^Edit Co-working desk, 15 Sept? 2026$/;
const DELETE_DESK = /^Delete Co-working desk, 15 Sept? 2026$/;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 16, 12));
  vi.mocked(coreApi.get).mockImplementation(answering(answers));
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe('OneTimeTab', () => {
  it('asks for this year’s one-time expenses only', async () => {
    renderWithProviders(<OneTimeTab />);
    await screen.findByText('Co-working desk');
    expect(coreApi.get).toHaveBeenCalledWith('/expenses', { params: YEAR });
  });

  it('lists each expense with its date, type, project, person and dollar amount', async () => {
    renderWithProviders(<OneTimeTab />);
    const desk = (await screen.findByText('Co-working desk')).closest('tr') as HTMLElement;
    expect(within(desk).getByText(/^15 Sept? 2026$/)).toBeInTheDocument();
    expect(within(desk).getByText('Travel')).toBeInTheDocument();
    expect(within(desk).getByText('Website')).toBeInTheDocument();
    expect(within(desk).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(desk).getByText('$100.00')).toBeInTheDocument();
  });

  it('shows a rupee charge’s original amount and rate, and no Recurring tag on a one-time expense', async () => {
    renderWithProviders(<OneTimeTab />);
    const desk = (await screen.findByText('Co-working desk')).closest('tr') as HTMLElement;
    expect(within(desk).getByText('₹8,825.00 at 88.25')).toBeInTheDocument();
    expect(within(desk).queryByText('Recurring')).not.toBeInTheDocument();
  });

  it('shows a dash for an expense that belongs to no person', async () => {
    vi.mocked(coreApi.get).mockImplementation(
      answering({ ...answers, '/expenses': [{ ...expenseRows[1], personId: null, person: null }] }),
    );
    renderWithProviders(<OneTimeTab />);
    const desk = (await screen.findByText('Co-working desk')).closest('tr') as HTMLElement;
    expect(within(desk).queryByText('Ada Lovelace')).not.toBeInTheDocument();
    expect(within(desk).getByText('—')).toBeInTheDocument(); // the project is Website, so the dash is the person
  });

  it('shows the total of the rows', async () => {
    renderWithProviders(<OneTimeTab />);
    expect(await screen.findByText('1 expense · $100.00')).toBeInTheDocument();
  });

  it('narrows by type, project, person and a search', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OneTimeTab />);
    await screen.findByText('Co-working desk');
    await user.selectOptions(screen.getByLabelText('Type'), '2');
    await waitFor(() =>
      expect(coreApi.get).toHaveBeenCalledWith('/expenses', { params: { ...YEAR, expenseTypeId: 2 } }),
    );
    await user.selectOptions(screen.getByLabelText('Project'), '1');
    await waitFor(() =>
      expect(coreApi.get).toHaveBeenCalledWith('/expenses', { params: { ...YEAR, expenseTypeId: 2, projectId: 1 } }),
    );
    await user.selectOptions(await screen.findByLabelText('Person'), '1');
    await waitFor(() =>
      expect(coreApi.get).toHaveBeenCalledWith('/expenses', {
        params: { ...YEAR, expenseTypeId: 2, projectId: 1, personId: 1 },
      }),
    );
    await user.type(screen.getByLabelText('Search expenses'), 'desk');
    await waitFor(() =>
      expect(coreApi.get).toHaveBeenCalledWith('/expenses', {
        params: { ...YEAR, expenseTypeId: 2, projectId: 1, personId: 1, q: 'desk' },
      }),
    );
  });

  it('offers every person in the Person filter', async () => {
    renderWithProviders(<OneTimeTab />);
    await screen.findByText('Co-working desk');
    const filter = screen.getByLabelText('Person');
    expect(await within(filter).findByRole('option', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(within(filter).getByRole('option', { name: 'Grace Hopper' })).toBeInTheDocument();
    expect(within(filter).getByRole('option', { name: 'All people' })).toBeInTheDocument();
  });

  it('narrows by date', async () => {
    renderWithProviders(<OneTimeTab />);
    await screen.findByText('Co-working desk');
    fireEvent.change(screen.getByLabelText('Charged from'), { target: { value: '2026-09-01' } });
    await waitFor(() =>
      expect(coreApi.get).toHaveBeenCalledWith('/expenses', {
        params: { from: '2026-09-01', to: '2026-12-31', recurring: false },
      }),
    );
  });

  it('clears the filters back to this year', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OneTimeTab />);
    await screen.findByText('Co-working desk');
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Type'), '2');
    await user.click(await screen.findByRole('button', { name: 'Clear filters' }));
    expect(screen.getByLabelText('Type')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('says when the start date is after the end date', async () => {
    renderWithProviders(<OneTimeTab />);
    await screen.findByText('Co-working desk');
    fireEvent.change(screen.getByLabelText('Charged from'), { target: { value: '2026-12-31' } });
    fireEvent.change(screen.getByLabelText('Charged to'), { target: { value: '2026-01-01' } });
    expect(await screen.findByText('The start date is after the end date.')).toBeInTheDocument();
  });

  it('exports the rows shown as a CSV file, the person included', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OneTimeTab />);
    await screen.findByText('Co-working desk');
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(downloadCsv).toHaveBeenCalledWith('expenses.csv', expect.stringContaining('Co-working desk'));
    const csv = vi.mocked(downloadCsv).mock.calls[0][1];
    expect(csv).toContain('Notes,Person');
    expect(csv).toContain('Ada Lovelace');
  });

  it('opens the new expense dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OneTimeTab />);
    await screen.findByText('Co-working desk');
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    expect(screen.getByRole('dialog', { name: 'New expense' })).toBeInTheDocument();
  });

  it('opens an expense to edit, named by its date because names can repeat', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OneTimeTab />);
    await user.click(await screen.findByRole('button', { name: EDIT_DESK }));
    const dialog = screen.getByRole('dialog', { name: 'Edit expense' });
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Co-working desk');
    expect(within(dialog).getByLabelText('Person')).toHaveValue('1'); // not the filter of the same name behind it
  });

  it('deletes an expense after the confirmation', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue({ data: expensesEnvelope({}) });
    const user = userEvent.setup();
    renderWithProviders(<OneTimeTab />);
    await user.click(await screen.findByRole('button', { name: DELETE_DESK }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('This cannot be undone.');
    await user.click(screen.getByRole('button', { name: 'Delete expense' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/expenses/2'));
  });

  it('invites the first one-time expense when there are none and no filter is set', async () => {
    vi.mocked(coreApi.get).mockImplementation(answering({ ...answers, '/expenses': [] }));
    renderWithProviders(<OneTimeTab />);
    expect(await screen.findByText('No one-time expenses yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  });

  it('says nothing matches when a filter leaves no expenses', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OneTimeTab />);
    await screen.findByText('Co-working desk');
    vi.mocked(coreApi.get).mockImplementation(answering({ ...answers, '/expenses': [] }));
    await user.selectOptions(screen.getByLabelText('Type'), '2');
    expect(await screen.findByText('No expenses match these filters.')).toBeInTheDocument();
  });

  it('offers a way to try again when the service is down', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(new Error('down'));
    renderWithProviders(<OneTimeTab />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
