import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import { answering, expenseTypeRows, expensesEnvelope, rejection } from '@/test/fixtures/expenses';
import { renderWithProviders } from '@/test/utils';
import { ExpenseTypesPage } from './expense-types-page';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const saved = { data: expensesEnvelope({}) };

beforeEach(() => {
  vi.mocked(coreApi.get).mockImplementation(answering({ '/expense-types': expenseTypeRows }));
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('ExpenseTypesPage', () => {
  it('asks the core service for the types', async () => {
    renderWithProviders(<ExpenseTypesPage />);
    await screen.findByText('Software subscription');
    expect(coreApi.get).toHaveBeenCalledWith('/expense-types');
  });

  it('lists each type with its description and dates, a missing description as empty', async () => {
    renderWithProviders(<ExpenseTypesPage />);
    expect(await screen.findByText('Tools we pay for')).toBeInTheDocument();
    expect(screen.getByText('Travel')).toBeInTheDocument();
    expect(screen.getAllByText('1 Oct 2026')).toHaveLength(4); // created and updated, for each of the two rows
    expect(screen.getByText('1–2 of 2')).toBeInTheDocument();
  });

  it('filters by search text and says when nothing matches', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExpenseTypesPage />);
    await screen.findByText('Travel');
    await user.type(screen.getByLabelText('Search expense types'), 'soft');
    expect(screen.queryByText('Travel')).not.toBeInTheDocument();
    expect(screen.getByText('Software subscription')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Search expense types'));
    await user.type(screen.getByLabelText('Search expense types'), 'zzz');
    expect(screen.getByText('No expense types match “zzz”.')).toBeInTheDocument();
  });

  it('creates a type from the dialog, a blank description going as null', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<ExpenseTypesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add expense type' }));
    await user.type(screen.getByLabelText('Name'), 'Legal');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith('/expense-types', { name: 'Legal', description: null }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('blocks a blank name and sends nothing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExpenseTypesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add expense type' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('edits a type with PATCH, starting from its current values', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<ExpenseTypesPage />);
    await user.click(await screen.findByRole('button', { name: 'Edit Travel' }));
    const name = screen.getByLabelText('Name');
    expect(name).toHaveValue('Travel');
    await user.clear(name);
    await user.type(name, 'Trips');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.patch).toHaveBeenCalledWith('/expense-types/2', { name: 'Trips', description: null }),
    );
  });

  it('says why a duplicate name was refused, and keeps the dialog open', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(rejection(409, 'An expense type named "Legal" already exists'));
    const user = userEvent.setup();
    renderWithProviders(<ExpenseTypesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add expense type' }));
    await user.type(screen.getByLabelText('Name'), 'Legal');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('An expense type named "Legal" already exists')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('deletes a type after the confirmation', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<ExpenseTypesPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete Travel' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('An expense type that an expense uses cannot be deleted.');
    await user.click(screen.getByRole('button', { name: 'Delete expense type' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/expense-types/2'));
  });

  it('offers a way to try again when the service is down', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(new Error('down'));
    renderWithProviders(<ExpenseTypesPage />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('invites the first type when there are none', async () => {
    vi.mocked(coreApi.get).mockImplementation(answering({ '/expense-types': [] }));
    renderWithProviders(<ExpenseTypesPage />);
    expect(await screen.findByText('No expense types yet.')).toBeInTheDocument();
  });
});
