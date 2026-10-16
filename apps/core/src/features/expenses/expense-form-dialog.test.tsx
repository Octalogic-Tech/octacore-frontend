import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import {
  answering,
  currencyRows,
  expenseRows,
  expenseTypeRows,
  expensesEnvelope,
  rejection,
} from '@/test/fixtures/expenses';
import { projectRows } from '@/test/fixtures/projects';
import { renderWithProviders } from '@/test/utils';
import { ExpenseFormDialog } from './expense-form-dialog';
import { expenseRowsSchema, type ExpenseRow } from './schema';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const [figma, desk] = expenseRowsSchema.parse(expenseRows); // figma in dollars, desk typed in rupees
const onOpenChange = vi.fn();
const saved = { data: expensesEnvelope({}) };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 16, 12));
  vi.mocked(coreApi.get).mockImplementation(
    answering({ '/expense-types': expenseTypeRows, '/projects': projectRows, '/currencies': currencyRows }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

async function openDialog(expense?: ExpenseRow) {
  renderWithProviders(<ExpenseFormDialog open onOpenChange={onOpenChange} expense={expense} />);
  // US dollars are chosen once the currency list is here.
  await waitFor(() => expect(screen.getByRole('option', { name: 'USD · US dollar' })).toBeInTheDocument());
}

describe('ExpenseFormDialog: adding', () => {
  it('starts on today, in US dollars', async () => {
    await openDialog();
    expect(screen.getByRole('dialog', { name: 'New expense' })).toBeInTheDocument();
    expect(screen.getByLabelText('Charge date')).toHaveValue('2026-10-16');
    await waitFor(() => expect(screen.getByLabelText('Currency')).toHaveValue('1'));
  });

  it('creates the expense with its amount in minor units', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    await openDialog();
    await user.type(screen.getByLabelText('Name'), 'Figma');
    await user.selectOptions(screen.getByLabelText('Type'), '1');
    await user.type(screen.getByLabelText('Amount'), '15');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/expenses', {
      name: 'Figma',
      notes: null,
      expenseTypeId: 1,
      projectId: null,
      chargeDate: '2026-10-16',
      currencyId: 1,
      amount: 1500,
    });
  });

  it('can attach a project and a note', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    await openDialog();
    await user.type(screen.getByLabelText('Name'), 'Hosting');
    await user.selectOptions(screen.getByLabelText('Type'), '1');
    await user.selectOptions(screen.getByLabelText('Project'), '1');
    await user.type(screen.getByLabelText('Notes'), 'Staging box');
    await user.type(screen.getByLabelText('Amount'), '9.99');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.post).toHaveBeenCalled());
    expect(coreApi.post).toHaveBeenCalledWith(
      '/expenses',
      expect.objectContaining({ projectId: 1, notes: 'Staging box', amount: 999 }),
    );
  });

  it('shows what a rupee amount comes to in dollars as it is typed', async () => {
    const user = userEvent.setup();
    await openDialog();
    await user.selectOptions(screen.getByLabelText('Currency'), '2');
    expect(screen.getByText(/In INR, like 7.20/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Amount'), '8825');
    expect(screen.getByText('About $100.00 at 88.25 INR per $1.')).toBeInTheDocument();
  });

  it('warns when a rupee amount is under one US cent', async () => {
    const user = userEvent.setup();
    await openDialog();
    await user.selectOptions(screen.getByLabelText('Currency'), '2');
    await user.type(screen.getByLabelText('Amount'), '0.01');
    expect(screen.getByText('Less than one US cent at 88.25 INR per $1.')).toBeInTheDocument();
  });

  it('sends the rupee amount and its currency, for the service to convert', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    await openDialog();
    await user.type(screen.getByLabelText('Name'), 'Desk');
    await user.selectOptions(screen.getByLabelText('Type'), '2');
    await user.selectOptions(screen.getByLabelText('Currency'), '2');
    await user.type(screen.getByLabelText('Amount'), '8825');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.post).toHaveBeenCalled());
    expect(coreApi.post).toHaveBeenCalledWith(
      '/expenses',
      expect.objectContaining({ currencyId: 2, amount: 882500 }),
    );
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

  it.each(['1,000', '7.999', '-5'])('tells how to type the amount %j', async (amount) => {
    const user = userEvent.setup();
    await openDialog();
    await user.type(screen.getByLabelText('Name'), 'Figma');
    await user.selectOptions(screen.getByLabelText('Type'), '1');
    await user.type(screen.getByLabelText('Amount'), amount);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter an amount like 7.20, with no commas or signs')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('shows the service’s own message and stays open when it refuses the amount', async () => {
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
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('says to try again when the save fails for another reason', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    await openDialog();
    await user.type(screen.getByLabelText('Name'), 'Figma');
    await user.selectOptions(screen.getByLabelText('Type'), '1');
    await user.type(screen.getByLabelText('Amount'), '15');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('That did not save. Try again.')).toBeInTheDocument();
  });
});

describe('ExpenseFormDialog: editing', () => {
  it('starts from the expense, a rupee charge in rupees', async () => {
    await openDialog(desk);
    expect(screen.getByRole('dialog', { name: 'Edit expense' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Co-working desk');
    expect(screen.getByLabelText('Type')).toHaveValue('2');
    expect(screen.getByLabelText('Project')).toHaveValue('1');
    expect(screen.getByLabelText('Charge date')).toHaveValue('2026-09-15');
    expect(screen.getByLabelText('Currency')).toHaveValue('2');
    expect(screen.getByLabelText('Amount')).toHaveValue('8825.00');
    expect(screen.getByLabelText('Notes')).toHaveValue('Pune');
  });

  // The service converts again, at today's rate, whenever it is sent a currency and an amount.
  it('does not send the amount or the currency when only the notes changed', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    await openDialog(desk);
    await user.clear(screen.getByLabelText('Notes'));
    await user.type(screen.getByLabelText('Notes'), 'Rent');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalled());
    expect(coreApi.patch).toHaveBeenCalledWith('/expenses/2', {
      name: 'Co-working desk',
      notes: 'Rent',
      expenseTypeId: 2,
      projectId: 1,
      chargeDate: '2026-09-15',
    });
  });

  it('sends the currency and the amount when the amount changed', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    await openDialog(desk);
    await user.clear(screen.getByLabelText('Amount'));
    await user.type(screen.getByLabelText('Amount'), '9000');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalled());
    expect(coreApi.patch).toHaveBeenCalledWith(
      '/expenses/2',
      expect.objectContaining({ currencyId: 2, amount: 900000 }),
    );
  });

  it('switches a rupee charge to dollars by sending the dollar currency and amount', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    await openDialog(desk);
    await user.selectOptions(screen.getByLabelText('Currency'), '1');
    await user.clear(screen.getByLabelText('Amount'));
    await user.type(screen.getByLabelText('Amount'), '99.99');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalled());
    expect(coreApi.patch).toHaveBeenCalledWith(
      '/expenses/2',
      expect.objectContaining({ currencyId: 1, amount: 9999 }),
    );
  });

  it('leaves a dollar charge’s amount alone when only the date changed', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    await openDialog(figma);
    await waitFor(() => expect(screen.getByLabelText('Currency')).toHaveValue('1'));
    fireEvent.change(screen.getByLabelText('Charge date'), { target: { value: '2026-10-03' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalled());
    expect(coreApi.patch).toHaveBeenCalledWith('/expenses/1', {
      name: 'Figma',
      notes: null,
      expenseTypeId: 1,
      projectId: null,
      chargeDate: '2026-10-03',
    });
  });

  it('keeps the expense’s own type and project in the lists while they are still loading', async () => {
    vi.mocked(coreApi.get).mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<ExpenseFormDialog open onOpenChange={onOpenChange} expense={desk} />);
    expect(screen.getByLabelText('Type')).toHaveValue('2');
    expect(screen.getByLabelText('Project')).toHaveValue('1');
    expect(screen.getByLabelText('Currency')).toHaveValue('2');
  });
});
