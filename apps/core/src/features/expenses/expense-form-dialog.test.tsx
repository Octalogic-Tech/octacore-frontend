import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import { countryRows } from '@/test/fixtures/countries';
import {
  answering,
  expenseRows,
  expenseTypeRows,
  expensesEnvelope,
  rejection,
} from '@/test/fixtures/expenses';
import { personRows } from '@/test/fixtures/people';
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
    answering({
      '/expense-types': expenseTypeRows,
      '/projects': projectRows,
      '/countries': countryRows,
      '/people': personRows,
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

async function openDialog(expense?: ExpenseRow) {
  renderWithProviders(<ExpenseFormDialog open onOpenChange={onOpenChange} expense={expense} />);
  // US dollars are chosen once the country list is here.
  await waitFor(() => expect(screen.getByRole('option', { name: 'United States · USD' })).toBeInTheDocument());
}

describe('ExpenseFormDialog: adding', () => {
  it('starts on today, in US dollars', async () => {
    await openDialog();
    expect(screen.getByRole('dialog', { name: 'New expense' })).toBeInTheDocument();
    expect(screen.getByLabelText('Charge date')).toHaveValue('2026-10-16');
    await waitFor(() => expect(screen.getByLabelText('Country')).toHaveValue('226'));
  });

  it('offers the active countries that have a rate, labelled with their currency, A to Z', async () => {
    await openDialog();
    const options = screen.getAllByRole('option', { name: /·/ }).map((option) => option.textContent);
    // Japan is active but has no rate yet, and the United Kingdom, France and Antarctica are switched off.
    expect(options).toEqual(['Germany · EUR', 'India · INR', 'United States · USD']);
  });

  it('starts on the United States, not on another country that uses dollars', async () => {
    vi.mocked(coreApi.get).mockImplementation(
      answering({
        '/expense-types': expenseTypeRows,
        '/projects': projectRows,
        '/countries': countryRows.map((row) => (row.iso === 'AQ' ? { ...row, active: true } : row)),
        '/people': personRows,
      }),
    );
    await openDialog();
    expect(screen.getByLabelText('Country')).toHaveValue('226');
  });

  it('starts on the first active country that uses dollars when the United States is not one', async () => {
    vi.mocked(coreApi.get).mockImplementation(
      answering({
        '/expense-types': expenseTypeRows,
        '/projects': projectRows,
        '/countries': countryRows.map((row) =>
          row.iso === 'US' ? { ...row, active: false } : row.iso === 'AQ' ? { ...row, active: true } : row,
        ),
        '/people': personRows,
      }),
    );
    renderWithProviders(<ExpenseFormDialog open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByLabelText('Country')).toHaveValue('8'));
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
      personId: null,
      chargeDate: '2026-10-16',
      countryId: 226,
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
    await user.selectOptions(screen.getByLabelText('Country'), '99');
    expect(screen.getByText(/In INR, like 7.20/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Amount'), '8825');
    expect(screen.getByText('About $100.00 at 88.25 INR per $1.')).toBeInTheDocument();
  });

  it('warns when a rupee amount is under one US cent', async () => {
    const user = userEvent.setup();
    await openDialog();
    await user.selectOptions(screen.getByLabelText('Country'), '99');
    await user.type(screen.getByLabelText('Amount'), '0.01');
    expect(screen.getByText('Less than one US cent at 88.25 INR per $1.')).toBeInTheDocument();
  });

  it('sends the rupee amount and its country, for the service to convert', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    await openDialog();
    await user.type(screen.getByLabelText('Name'), 'Desk');
    await user.selectOptions(screen.getByLabelText('Type'), '2');
    await user.selectOptions(screen.getByLabelText('Country'), '99');
    await user.type(screen.getByLabelText('Amount'), '8825');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.post).toHaveBeenCalled());
    expect(coreApi.post).toHaveBeenCalledWith(
      '/expenses',
      expect.objectContaining({ countryId: 99, amount: 882500 }),
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
      rejection(422, 'That amount is less than one US cent at this country’s rate'),
    );
    const user = userEvent.setup();
    await openDialog();
    await user.type(screen.getByLabelText('Name'), 'Figma');
    await user.selectOptions(screen.getByLabelText('Type'), '1');
    await user.type(screen.getByLabelText('Amount'), '15');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('That amount is less than one US cent at this country’s rate')).toBeInTheDocument();
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
    expect(screen.getByLabelText('Person')).toHaveValue('1');
    expect(screen.getByLabelText('Charge date')).toHaveValue('2026-09-15');
    expect(screen.getByLabelText('Country')).toHaveValue('99');
    expect(screen.getByLabelText('Amount')).toHaveValue('8825.00');
    expect(screen.getByLabelText('Notes')).toHaveValue('Pune');
  });

  // The service converts again, at today's rate, whenever it is sent a country and an amount.
  it('does not send the amount or the country when only the notes changed', async () => {
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
      personId: 1,
      chargeDate: '2026-09-15',
    });
  });

  it('sends the country and the amount when the amount changed', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    await openDialog(desk);
    await user.clear(screen.getByLabelText('Amount'));
    await user.type(screen.getByLabelText('Amount'), '9000');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalled());
    expect(coreApi.patch).toHaveBeenCalledWith(
      '/expenses/2',
      expect.objectContaining({ countryId: 99, amount: 900000 }),
    );
  });

  it('switches a rupee charge to dollars by sending the dollar country and amount', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    await openDialog(desk);
    await user.selectOptions(screen.getByLabelText('Country'), '226');
    await user.clear(screen.getByLabelText('Amount'));
    await user.type(screen.getByLabelText('Amount'), '99.99');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalled());
    expect(coreApi.patch).toHaveBeenCalledWith(
      '/expenses/2',
      expect.objectContaining({ countryId: 226, amount: 9999 }),
    );
  });

  it('leaves a dollar charge’s amount alone when only the date changed', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    await openDialog(figma);
    await waitFor(() => expect(screen.getByLabelText('Country')).toHaveValue('226'));
    fireEvent.change(screen.getByLabelText('Charge date'), { target: { value: '2026-10-03' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalled());
    expect(coreApi.patch).toHaveBeenCalledWith('/expenses/1', {
      name: 'Figma',
      notes: null,
      expenseTypeId: 1,
      projectId: null,
      personId: null,
      chargeDate: '2026-10-03',
    });
  });

  // The service lets an expense keep a country that has since been switched off, so the edit must not blank it.
  it('keeps the expense’s own country in the list after it was switched off, and does not resend it', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    const pound = { id: 225, name: 'United Kingdom', currencyCode: 'GBP', currencySymbol: '£' };
    await openDialog({ ...desk, originalCountry: pound });
    expect(screen.getByRole('option', { name: 'United Kingdom · GBP' })).toBeInTheDocument();
    expect(screen.getByLabelText('Country')).toHaveValue('225');
    await user.type(screen.getByLabelText('Notes'), '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalled());
    // Only the notes changed, so neither the country nor the amount goes.
    expect(coreApi.patch).toHaveBeenCalledWith('/expenses/2', expect.not.objectContaining({ countryId: expect.anything() }));
  });

  it('opens a dollar expense on the United States', async () => {
    await openDialog(figma);
    await waitFor(() => expect(screen.getByLabelText('Country')).toHaveValue('226'));
    expect(screen.getByText('In US dollars, like 7.20.')).toBeInTheDocument();
  });

  it('keeps the expense’s own type and project in the lists while they are still loading', async () => {
    vi.mocked(coreApi.get).mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<ExpenseFormDialog open onOpenChange={onOpenChange} expense={desk} />);
    expect(screen.getByLabelText('Type')).toHaveValue('2');
    expect(screen.getByLabelText('Project')).toHaveValue('1');
    expect(screen.getByLabelText('Country')).toHaveValue('99');
  });
});

describe('ExpenseFormDialog: the person', () => {
  it('lists the people to choose from, none being the starting choice', async () => {
    await openDialog();
    expect(await screen.findByRole('option', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Grace Hopper' })).toBeInTheDocument();
    expect(screen.getByLabelText('Person')).toHaveValue('');
  });

  it('sends the person chosen', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    await openDialog();
    await screen.findByRole('option', { name: 'Ada Lovelace' });
    await user.type(screen.getByLabelText('Name'), 'Laptop');
    await user.selectOptions(screen.getByLabelText('Type'), '2');
    await user.selectOptions(screen.getByLabelText('Person'), '1');
    await user.type(screen.getByLabelText('Amount'), '1200');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.post).toHaveBeenCalled());
    expect(coreApi.post).toHaveBeenCalledWith('/expenses', expect.objectContaining({ personId: 1 }));
  });

  it('clears the person by choosing none', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    await openDialog(desk);
    await user.selectOptions(screen.getByLabelText('Person'), '');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalled());
    expect(coreApi.patch).toHaveBeenCalledWith('/expenses/2', expect.objectContaining({ personId: null }));
  });

  it('keeps the expense’s own person in the list while the people are loading', async () => {
    vi.mocked(coreApi.get).mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<ExpenseFormDialog open onOpenChange={onOpenChange} expense={desk} />);
    expect(screen.getByLabelText('Person')).toHaveValue('1');
  });
});
