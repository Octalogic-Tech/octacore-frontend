import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import {
  answering,
  currencyRows,
  expenseTypeRows,
  expensesEnvelope,
  recurringRows,
  rejection,
} from '@/test/fixtures/expenses';
import { personRows } from '@/test/fixtures/people';
import { projectRows } from '@/test/fixtures/projects';
import { renderWithProviders } from '@/test/utils';
import { RecurringTab } from './recurring-tab';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const answers = {
  '/recurring-expenses': recurringRows,
  '/expense-types': expenseTypeRows,
  '/projects': projectRows,
  '/currencies': currencyRows,
  '/people': personRows,
};
const saved = { data: expensesEnvelope({}) };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 16, 12));
  vi.mocked(coreApi.get).mockImplementation(answering(answers));
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

const rowOf = async (name: string) => (await screen.findByText(name)).closest('tr') as HTMLElement;

describe('RecurringTab', () => {
  it('asks the core service for the recurring expenses', async () => {
    renderWithProviders(<RecurringTab />);
    await screen.findByText('Figma');
    expect(coreApi.get).toHaveBeenCalledWith('/recurring-expenses');
  });

  it('lists the active ones first, then the paused, then the cancelled', async () => {
    renderWithProviders(<RecurringTab />);
    await screen.findByText('Figma');
    const names = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[0].textContent);
    expect(names.map((name) => name?.replace(/Pune$/, ''))).toEqual(['Figma', 'Co-working desk', 'Old VPN']);
  });

  it('shows what the active ones cost per month and per year', async () => {
    renderWithProviders(<RecurringTab />);
    expect(await screen.findByText('Active: $15.00 per month · $180.00 per year')).toBeInTheDocument();
  });

  it('shows each charge in its own currency, a rupee one with its dollar equivalent', async () => {
    renderWithProviders(<RecurringTab />);
    const figma = await rowOf('Figma');
    expect(within(figma).getByText('$15.00')).toBeInTheDocument();
    expect(within(figma).getByText('Monthly')).toBeInTheDocument();
    const desk = await rowOf('Co-working desk');
    expect(within(desk).getByText('₹8,825.00')).toBeInTheDocument();
    expect(within(desk).getByText('about $100.00')).toBeInTheDocument();
    const vpn = await rowOf('Old VPN');
    expect(within(vpn).getByText('Quarterly')).toBeInTheDocument();
  });

  it('shows who a recurring expense is for, and a dash when it is for no one', async () => {
    renderWithProviders(<RecurringTab />);
    const desk = await rowOf('Co-working desk');
    expect(within(desk).getByText('Ada Lovelace')).toBeInTheDocument();
    const figma = await rowOf('Figma');
    expect(within(figma).getByText('—')).toBeInTheDocument();
  });

  it('shows the next charge and the state, and Ended for a cancelled one', async () => {
    renderWithProviders(<RecurringTab />);
    const figma = await rowOf('Figma');
    expect(within(figma).getByText('1 Nov 2026')).toBeInTheDocument();
    expect(within(figma).getByText('Active')).toBeInTheDocument();
    expect(within(await rowOf('Co-working desk')).getByText('Paused')).toBeInTheDocument();
    const vpn = await rowOf('Old VPN');
    expect(within(vpn).getByText('Cancelled')).toBeInTheDocument();
    expect(within(vpn).getByText('Ended')).toBeInTheDocument();
  });

  it('offers only the actions that fit the state', async () => {
    renderWithProviders(<RecurringTab />);
    await screen.findByText('Figma');
    expect(screen.getByRole('button', { name: 'Pause Figma' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel Figma' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume Figma' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume Co-working desk' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause Co-working desk' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reactivate Old VPN' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel Old VPN' })).not.toBeInTheDocument();
  });

  it('pauses after the confirmation', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<RecurringTab />);
    await user.click(await screen.findByRole('button', { name: 'Pause Figma' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('the charges it missed are not created');
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalledWith('/recurring-expenses/7', { state: 'paused' }));
  });

  it('resumes and reactivates after the confirmation', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<RecurringTab />);
    await user.click(await screen.findByRole('button', { name: 'Resume Co-working desk' }));
    await user.click(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalledWith('/recurring-expenses/8', { state: 'active' }));
    await user.click(screen.getByRole('button', { name: 'Reactivate Old VPN' }));
    await user.click(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalledWith('/recurring-expenses/9', { state: 'active' }));
  });

  it('cancels after the confirmation', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<RecurringTab />);
    await user.click(await screen.findByRole('button', { name: 'Cancel Figma' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('It stops creating charges.');
    await user.click(screen.getByRole('button', { name: 'Cancel recurring expense' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalledWith('/recurring-expenses/7', { state: 'cancelled' }));
  });

  it('shows the service’s reason on the page when it refuses a resume', async () => {
    vi.mocked(coreApi.patch).mockRejectedValue(rejection(422, 'The end date has passed: change or clear it first'));
    const user = userEvent.setup();
    renderWithProviders(<RecurringTab />);
    await user.click(await screen.findByRole('button', { name: 'Reactivate Old VPN' }));
    await user.click(screen.getByRole('button', { name: 'Resume' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The end date has passed: change or clear it first');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('deletes after the confirmation, saying the charges stay', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<RecurringTab />);
    await user.click(await screen.findByRole('button', { name: 'Delete Old VPN' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('The charges it made stay in the ledger.');
    await user.click(screen.getByRole('button', { name: 'Delete recurring expense' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/recurring-expenses/9'));
  });

  it('opens an expense to edit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecurringTab />);
    await user.click(await screen.findByRole('button', { name: 'Edit Figma' }));
    expect(screen.getByRole('dialog', { name: 'Edit recurring expense' })).toBeInTheDocument();
  });

  it('says how many charges a new expense made, or that none is due yet', async () => {
    vi.mocked(coreApi.post).mockResolvedValueOnce({ data: expensesEnvelope({ generatedCount: 3 }) });
    const user = userEvent.setup();
    renderWithProviders(<RecurringTab />);
    const add = async (name: string) => {
      await user.click(await screen.findByRole('button', { name: 'Add recurring expense' }));
      await user.type(screen.getByLabelText('Name'), name);
      await user.selectOptions(screen.getByLabelText('Type'), '1');
      await user.type(screen.getByLabelText('Amount'), '15');
      fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-08-01' } });
      await user.click(screen.getByRole('button', { name: 'Save' }));
    };
    await add('Linear');
    expect(await screen.findByRole('status')).toHaveTextContent('Created 3 charges.');
    vi.mocked(coreApi.post).mockResolvedValueOnce({ data: expensesEnvelope({ generatedCount: 0 }) });
    await add('Notion');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved. No charge is due yet.'));
  });

  it('says one charge, not "1 charges"', async () => {
    vi.mocked(coreApi.post).mockResolvedValue({ data: expensesEnvelope({ generatedCount: 1 }) });
    const user = userEvent.setup();
    renderWithProviders(<RecurringTab />);
    await user.click(await screen.findByRole('button', { name: 'Add recurring expense' }));
    await user.type(screen.getByLabelText('Name'), 'Linear');
    await user.selectOptions(screen.getByLabelText('Type'), '1');
    await user.type(screen.getByLabelText('Amount'), '15');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Created 1 charge.');
  });

  it('invites the first recurring expense when there are none', async () => {
    vi.mocked(coreApi.get).mockImplementation(answering({ ...answers, '/recurring-expenses': [] }));
    renderWithProviders(<RecurringTab />);
    expect(await screen.findByText('No recurring expenses yet.')).toBeInTheDocument();
  });

  it('offers a way to try again when the service is down', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(new Error('down'));
    renderWithProviders(<RecurringTab />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
