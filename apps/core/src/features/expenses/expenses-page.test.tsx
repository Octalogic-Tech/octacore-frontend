import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { coreApi } from '@/lib/core-api';
import {
  answering,
  currencyRows,
  expenseRows,
  expenseTypeRows,
  recurringRows,
} from '@/test/fixtures/expenses';
import { personRows } from '@/test/fixtures/people';
import { projectRows } from '@/test/fixtures/projects';
import { renderWithProviders } from '@/test/utils';
import { ExpensesPage } from './expenses-page';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const answers = {
  '/expenses': expenseRows,
  '/recurring-expenses': recurringRows,
  '/expense-types': expenseTypeRows,
  '/projects': projectRows,
  '/currencies': currencyRows,
  '/people': personRows,
};

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{pathname + search}</p>;
}

function renderPage(route = '/finance/expenses') {
  return renderWithProviders(
    <>
      <ExpensesPage />
      <Where />
    </>,
    { route },
  );
}

const where = () => screen.getByTestId('where').textContent;

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
  it('is one page with an Overview, a One-time and a Recurring tab', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Expenses' })).toBeInTheDocument();
    const tabs = screen.getByRole('tablist', { name: 'Expense sections' });
    expect(within(tabs).getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Overview',
      'One-time',
      'Recurring',
    ]);
    await screen.findByText('Figma');
  });

  it('opens on the Overview, showing this month’s expenses', async () => {
    renderPage();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('heading', { level: 2, name: 'October 2026' })).toBeInTheDocument();
    expect(coreApi.get).toHaveBeenCalledWith('/expenses', { params: { from: '2026-10-01', to: '2026-10-31' } });
    expect(where()).toBe('/finance/expenses');
  });

  it('shows the One-time tab, and keeps it in the address', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Figma');
    await user.click(screen.getByRole('tab', { name: 'One-time' }));
    expect(where()).toBe('/finance/expenses?tab=one-time');
    expect(screen.getByRole('tab', { name: 'One-time' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() =>
      expect(coreApi.get).toHaveBeenCalledWith('/expenses', {
        params: { from: '2026-01-01', to: '2026-12-31', recurring: false },
      }),
    );
  });

  it('shows the Recurring tab, and keeps it in the address', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Figma');
    await user.click(screen.getByRole('tab', { name: 'Recurring' }));
    expect(where()).toBe('/finance/expenses?tab=recurring');
    expect(await screen.findByRole('button', { name: 'Add recurring expense' })).toBeInTheDocument();
  });

  it('goes back to the bare address on the Overview', async () => {
    const user = userEvent.setup();
    renderPage('/finance/expenses?tab=recurring');
    await user.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(where()).toBe('/finance/expenses');
  });

  it('lands on the tab the address names', async () => {
    renderPage('/finance/expenses?tab=recurring');
    expect(screen.getByRole('tab', { name: 'Recurring' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('button', { name: 'Add recurring expense' })).toBeInTheDocument();
  });

  it('falls back to the Overview for a tab it does not know', async () => {
    renderPage('/finance/expenses?tab=nonsense');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    await screen.findByText('Figma');
  });

  it('lands on the month the address names', async () => {
    renderPage('/finance/expenses?month=2026-09');
    expect(await screen.findByRole('heading', { level: 2, name: 'September 2026' })).toBeInTheDocument();
    expect(coreApi.get).toHaveBeenCalledWith('/expenses', { params: { from: '2026-09-01', to: '2026-09-30' } });
  });

  it('falls back to this month for a month it does not know', async () => {
    renderPage('/finance/expenses?month=2026-13');
    expect(await screen.findByRole('heading', { level: 2, name: 'October 2026' })).toBeInTheDocument();
  });

  it('keeps the month in the address, leaving it bare for this month', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Figma');
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(where()).toBe('/finance/expenses?month=2026-09');
    expect(await screen.findByRole('heading', { level: 2, name: 'September 2026' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(where()).toBe('/finance/expenses');
    expect(await screen.findByRole('heading', { level: 2, name: 'October 2026' })).toBeInTheDocument();
  });

  it('does not show the previous month’s expenses under the new month while it loads', async () => {
    const user = userEvent.setup();
    renderPage();
    const figures = await screen.findByLabelText('Spend in October 2026');
    await waitFor(() => expect(within(figures).getByText('Total').nextSibling).toHaveTextContent('$115.00'));
    vi.mocked(coreApi.get).mockImplementation(() => new Promise(() => undefined)); // September never arrives
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'September 2026' })).toBeInTheDocument();
    expect(screen.queryByText('Figma')).not.toBeInTheDocument();
    expect(screen.queryByText('Co-working desk')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    const september = screen.getByLabelText('Spend in September 2026');
    expect(within(september).getByText('Total').nextSibling).toHaveTextContent('—');
  });

  it('leaves the month behind when another tab is chosen', async () => {
    const user = userEvent.setup();
    renderPage('/finance/expenses?month=2026-09');
    await user.click(screen.getByRole('tab', { name: 'One-time' }));
    expect(where()).toBe('/finance/expenses?tab=one-time');
  });
});
