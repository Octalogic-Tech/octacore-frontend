import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
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
import { OverviewTab } from './overview-tab';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

// The month's expenses, one-time and generated together: Figma ($15, a recurring charge) and the rupee desk ($100).
const answers = {
  '/expenses': expenseRows,
  '/expense-types': expenseTypeRows,
  '/projects': projectRows,
  '/currencies': currencyRows,
  '/people': personRows,
};

const OCTOBER = { from: '2026-10-01', to: '2026-10-31' };
const onMonthChange = vi.fn();

function renderTab(month = '2026-10') {
  return renderWithProviders(<OverviewTab month={month} thisMonth="2026-10" onMonthChange={onMonthChange} />);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 16, 12));
  vi.mocked(coreApi.get).mockImplementation(answering(answers));
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe('OverviewTab', () => {
  it('asks for the whole month, one-time expenses and generated charges together', async () => {
    renderTab();
    await screen.findByText('Figma');
    expect(coreApi.get).toHaveBeenCalledWith('/expenses', { params: OCTOBER });
  });

  it('asks for the month it is given, February included', async () => {
    renderTab('2028-02');
    await screen.findByText('Figma');
    expect(coreApi.get).toHaveBeenCalledWith('/expenses', { params: { from: '2028-02-01', to: '2028-02-29' } });
  });

  it('names the month', async () => {
    renderTab();
    expect(await screen.findByRole('heading', { level: 2, name: 'October 2026' })).toBeInTheDocument();
  });

  it('lists the month’s expenses with their type, project, person and amount', async () => {
    renderTab();
    const figma = (await screen.findByText('Figma')).closest('tr') as HTMLElement;
    expect(within(figma).getByText('Software subscription')).toBeInTheDocument();
    expect(within(figma).getByText('$15.00')).toBeInTheDocument();
    const desk = screen.getByText('Co-working desk').closest('tr') as HTMLElement;
    expect(within(desk).getByText('Website')).toBeInTheDocument();
    expect(within(desk).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(desk).getByText('$100.00')).toBeInTheDocument();
  });

  it('tags a charge a recurring expense made, and shows a rupee charge’s original amount and rate', async () => {
    renderTab();
    const figma = (await screen.findByText('Figma')).closest('tr') as HTMLElement;
    expect(within(figma).getByText('Recurring')).toBeInTheDocument();
    const desk = screen.getByText('Co-working desk').closest('tr') as HTMLElement;
    expect(within(desk).queryByText('Recurring')).not.toBeInTheDocument();
    expect(within(desk).getByText('₹8,825.00 at 88.25')).toBeInTheDocument();
  });

  it('shows the month’s total, and how much of it is one-time and how much recurring', async () => {
    renderTab();
    const figures = await screen.findByLabelText('Spend in October 2026');
    // Dashes until the rows are in.
    await waitFor(() => expect(within(figures).getByText('Total').nextSibling).toHaveTextContent('$115.00'));
    expect(within(figures).getByText('One-time').nextSibling).toHaveTextContent('$100.00');
    expect(within(figures).getByText('Recurring').nextSibling).toHaveTextContent('$15.00');
  });

  it('shows the month’s total by type', async () => {
    renderTab();
    const byType = await screen.findByRole('region', { name: 'By type' });
    expect(within(byType).getByText('Travel')).toBeInTheDocument();
    expect(within(byType).getByText('$100.00')).toBeInTheDocument();
    expect(within(byType).getByText('Software subscription')).toBeInTheDocument();
    expect(within(byType).getByText('$15.00')).toBeInTheDocument();
  });

  it('moves to the month before and the month after', async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText('Figma');
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(onMonthChange).toHaveBeenLastCalledWith('2026-09');
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(onMonthChange).toHaveBeenLastCalledWith('2026-11');
  });

  it('offers a way back to this month only from another month', async () => {
    const user = userEvent.setup();
    const { unmount } = renderTab();
    await screen.findByText('Figma');
    expect(screen.queryByRole('button', { name: 'This month' })).not.toBeInTheDocument();
    unmount();
    renderTab('2026-08');
    await user.click(await screen.findByRole('button', { name: 'This month' }));
    expect(onMonthChange).toHaveBeenLastCalledWith('2026-10');
  });

  it('narrows by type, project and person, and the month stays', async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText('Figma');
    await user.selectOptions(screen.getByLabelText('Type'), '2');
    await waitFor(() =>
      expect(coreApi.get).toHaveBeenCalledWith('/expenses', { params: { ...OCTOBER, expenseTypeId: 2 } }),
    );
    await user.selectOptions(screen.getByLabelText('Project'), '1');
    await waitFor(() =>
      expect(coreApi.get).toHaveBeenCalledWith('/expenses', { params: { ...OCTOBER, expenseTypeId: 2, projectId: 1 } }),
    );
    await user.selectOptions(await screen.findByLabelText('Person'), '1');
    await waitFor(() =>
      expect(coreApi.get).toHaveBeenCalledWith('/expenses', {
        params: { ...OCTOBER, expenseTypeId: 2, projectId: 1, personId: 1 },
      }),
    );
  });

  it('clears the filters', async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText('Figma');
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Type'), '2');
    await user.click(await screen.findByRole('button', { name: 'Clear filters' }));
    expect(screen.getByLabelText('Type')).toHaveValue('');
  });

  it('says so when the month has no expenses, and invites one', async () => {
    vi.mocked(coreApi.get).mockImplementation(answering({ ...answers, '/expenses': [] }));
    renderTab();
    expect(await screen.findByText('No expenses in October 2026.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add an expense' })).toBeInTheDocument();
  });

  it('says nothing matches when a filter leaves no expenses', async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText('Figma');
    vi.mocked(coreApi.get).mockImplementation(answering({ ...answers, '/expenses': [] }));
    await user.selectOptions(screen.getByLabelText('Type'), '2');
    expect(await screen.findByText('No expenses match these filters.')).toBeInTheDocument();
  });

  it('offers a way to try again when the service is down', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(new Error('down'));
    renderTab();
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('opens the new expense dialog', async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText('Figma');
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    expect(screen.getByRole('dialog', { name: 'New expense' })).toBeInTheDocument();
  });

  it('opens an expense to edit', async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByRole('button', { name: 'Edit Figma, 1 Oct 2026' }));
    expect(screen.getByRole('dialog', { name: 'Edit expense' })).toBeInTheDocument();
  });

  it('deletes after the confirmation, warning that a generated charge does not come back', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue({ data: expensesEnvelope({}) });
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByRole('button', { name: 'Delete Figma, 1 Oct 2026' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('The charge is not created again.');
    await user.click(screen.getByRole('button', { name: 'Delete expense' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/expenses/1'));
  });
});
