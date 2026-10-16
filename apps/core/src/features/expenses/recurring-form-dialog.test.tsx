import { fireEvent, screen, waitFor } from '@testing-library/react';
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
import { RecurringFormDialog } from './recurring-form-dialog';
import { recurringRowsSchema, type RecurringRow } from './schema';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const [figma, desk] = recurringRowsSchema.parse(recurringRows); // active in dollars, paused in rupees
const onOpenChange = vi.fn();
const onSaved = vi.fn();
const created = (generatedCount: number) => ({ data: expensesEnvelope({ generatedCount }) });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 16, 12));
  vi.mocked(coreApi.get).mockImplementation(
    answering({
      '/expense-types': expenseTypeRows,
      '/projects': projectRows,
      '/currencies': currencyRows,
      '/people': personRows,
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

async function openDialog(expense?: RecurringRow) {
  renderWithProviders(<RecurringFormDialog open onOpenChange={onOpenChange} expense={expense} onSaved={onSaved} />);
  await waitFor(() => expect(screen.getByRole('option', { name: 'USD · US dollar' })).toBeInTheDocument());
}

describe('RecurringFormDialog: adding', () => {
  it('starts monthly, from today, in US dollars', async () => {
    await openDialog();
    expect(screen.getByRole('dialog', { name: 'New recurring expense' })).toBeInTheDocument();
    expect(screen.getByLabelText('Frequency')).toHaveValue('monthly');
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-10-16');
    await waitFor(() => expect(screen.getByLabelText('Currency')).toHaveValue('1'));
  });

  it('creates the expense and reports how many charges it made at once', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(created(3));
    const user = userEvent.setup();
    await openDialog();
    await user.type(screen.getByLabelText('Name'), 'Figma');
    await user.selectOptions(screen.getByLabelText('Type'), '1');
    await user.type(screen.getByLabelText('Amount'), '15');
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-08-01' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(3));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(coreApi.post).toHaveBeenCalledWith('/recurring-expenses', {
      name: 'Figma',
      notes: null,
      expenseTypeId: 1,
      projectId: null,
      personId: null,
      currencyId: 1,
      amount: 1500,
      frequency: 'monthly',
      startDate: '2026-08-01',
      endDate: null,
    });
  });

  it('can charge a rupee amount yearly, with an end date', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(created(0));
    const user = userEvent.setup();
    await openDialog();
    await user.type(screen.getByLabelText('Name'), 'Domain');
    await user.selectOptions(screen.getByLabelText('Type'), '1');
    await user.selectOptions(screen.getByLabelText('Frequency'), 'yearly');
    await user.selectOptions(screen.getByLabelText('Currency'), '2');
    await user.type(screen.getByLabelText('Amount'), '1500');
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2030-10-16' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.post).toHaveBeenCalled());
    expect(coreApi.post).toHaveBeenCalledWith(
      '/recurring-expenses',
      expect.objectContaining({ frequency: 'yearly', currencyId: 2, amount: 150000, endDate: '2030-10-16' }),
    );
    expect(screen.getByText('About $17.00 at 88.25 INR per $1.')).toBeInTheDocument(); // 150000 / 88.25 = 1699.7 cents
  });

  it('blocks an empty form and sends nothing', async () => {
    const user = userEvent.setup();
    await openDialog();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Choose a type')).toBeInTheDocument();
    expect(screen.getByText('Enter an amount')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('refuses an end date before the start and dates outside the years the service takes', async () => {
    const user = userEvent.setup();
    await openDialog();
    await user.type(screen.getByLabelText('Name'), 'Figma');
    await user.selectOptions(screen.getByLabelText('Type'), '1');
    await user.type(screen.getByLabelText('Amount'), '15');
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-10-01' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('The end date must not be before the start date')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '1999-12-31' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('The start date must be between the years 2000 and 2100')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('shows the service’s own message and stays open when it refuses', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(
      rejection(422, 'That amount is less than one US cent at this currency’s rate'),
    );
    const user = userEvent.setup();
    await openDialog();
    await user.type(screen.getByLabelText('Name'), 'Figma');
    await user.selectOptions(screen.getByLabelText('Type'), '1');
    await user.type(screen.getByLabelText('Amount'), '15');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('That amount is less than one US cent at this currency’s rate')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe('RecurringFormDialog: editing', () => {
  it('starts from the expense, a rupee expense in rupees', async () => {
    await openDialog(desk);
    expect(screen.getByRole('dialog', { name: 'Edit recurring expense' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Co-working desk');
    expect(screen.getByLabelText('Currency')).toHaveValue('2');
    expect(screen.getByLabelText('Person')).toHaveValue('1');
    expect(screen.getByLabelText('Amount')).toHaveValue('8825.00');
    expect(screen.getByLabelText('Frequency')).toHaveValue('monthly');
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-08-15');
  });

  it('locks the start date once a charge exists, and not before', async () => {
    await openDialog(figma);
    expect(screen.getByLabelText('Start date')).toHaveAttribute('readonly');
    expect(screen.getByText('Fixed once a charge has been created.')).toBeInTheDocument();
  });

  it('leaves the start date open while no charge has been created', async () => {
    await openDialog({ ...figma, lastChargeDate: null, startDate: '2027-01-01' });
    expect(screen.getByLabelText('Start date')).not.toHaveAttribute('readonly');
  });

  it('sends the whole expense on an edit, and reports nothing about charges', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue({ data: expensesEnvelope({}) });
    const user = userEvent.setup();
    await openDialog(figma);
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Figma Pro');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/recurring-expenses/7', {
      name: 'Figma Pro',
      notes: null,
      expenseTypeId: 1,
      projectId: null,
      personId: null,
      currencyId: 1,
      amount: 1500,
      frequency: 'monthly',
      startDate: '2026-07-01',
      endDate: null,
    });
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('clears the end date by emptying it', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue({ data: expensesEnvelope({}) });
    const user = userEvent.setup();
    await openDialog({ ...figma, endDate: '2027-06-30' });
    expect(screen.getByLabelText('End date')).toHaveValue('2027-06-30');
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalled());
    expect(coreApi.patch).toHaveBeenCalledWith('/recurring-expenses/7', expect.objectContaining({ endDate: null }));
  });
});

describe('RecurringFormDialog: the person', () => {
  it('lists the people to choose from, none being the starting choice', async () => {
    await openDialog();
    expect(await screen.findByRole('option', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByLabelText('Person')).toHaveValue('');
  });

  it('sends the person chosen, and the service gives it to every charge', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(created(1));
    const user = userEvent.setup();
    await openDialog();
    await screen.findByRole('option', { name: 'Ada Lovelace' });
    await user.type(screen.getByLabelText('Name'), 'Figma seat');
    await user.selectOptions(screen.getByLabelText('Type'), '1');
    await user.selectOptions(screen.getByLabelText('Person'), '1');
    await user.type(screen.getByLabelText('Amount'), '15');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.post).toHaveBeenCalled());
    expect(coreApi.post).toHaveBeenCalledWith('/recurring-expenses', expect.objectContaining({ personId: 1 }));
  });

  it('clears the person by choosing none', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue({ data: expensesEnvelope({}) });
    const user = userEvent.setup();
    await openDialog(desk);
    await user.selectOptions(screen.getByLabelText('Person'), '');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalled());
    expect(coreApi.patch).toHaveBeenCalledWith('/recurring-expenses/8', expect.objectContaining({ personId: null }));
  });
});
