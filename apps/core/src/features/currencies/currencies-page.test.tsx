import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import { answering, currencyRows, expensesEnvelope, rejection } from '@/test/fixtures/expenses';
import { renderWithProviders } from '@/test/utils';
import { CurrenciesPage } from './currencies-page';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const saved = { data: expensesEnvelope({}) };

beforeEach(() => {
  vi.mocked(coreApi.get).mockImplementation(answering({ '/currencies': currencyRows }));
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('CurrenciesPage', () => {
  it('asks the core service for the currencies', async () => {
    renderWithProviders(<CurrenciesPage />);
    await screen.findByText('Indian rupee');
    expect(coreApi.get).toHaveBeenCalledWith('/currencies');
  });

  it('lists each currency with its rate per US dollar', async () => {
    renderWithProviders(<CurrenciesPage />);
    const rupee = (await screen.findByText('Indian rupee')).closest('tr') as HTMLElement;
    expect(within(rupee).getByText('INR')).toBeInTheDocument();
    expect(within(rupee).getByText('₹')).toBeInTheDocument();
    expect(within(rupee).getByText('88.25')).toBeInTheDocument();
  });

  it('keeps US dollars locked: no edit, no delete, and a Primary mark', async () => {
    renderWithProviders(<CurrenciesPage />);
    const dollar = (await screen.findByText('US dollar')).closest('tr') as HTMLElement;
    expect(within(dollar).getByText('Primary')).toBeInTheDocument();
    expect(within(dollar).queryByRole('button')).not.toBeInTheDocument();
    const rupee = screen.getByText('Indian rupee').closest('tr') as HTMLElement;
    expect(within(rupee).getByRole('button', { name: 'Edit Indian rupee' })).toBeInTheDocument();
    expect(within(rupee).getByRole('button', { name: 'Delete Indian rupee' })).toBeInTheDocument();
  });

  it('adds a currency with its rate as a number, typing the code in capitals', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<CurrenciesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add currency' }));
    await user.type(screen.getByLabelText('Code'), 'eur');
    expect(screen.getByLabelText('Code')).toHaveValue('EUR');
    await user.type(screen.getByLabelText('Name'), 'Euro');
    await user.type(screen.getByLabelText('Symbol'), '€');
    await user.type(screen.getByLabelText('Rate'), '0.92');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith('/currencies', {
        code: 'EUR',
        name: 'Euro',
        symbol: '€',
        rate: 0.92,
      }),
    );
  });

  it.each([
    ['1,5', 'Enter a rate like 88.25, with no commas and at most six decimals'],
    ['0', 'The rate must be more than zero'],
    ['1000001', 'The rate is too large'],
    ['0.1234567', 'Enter a rate like 88.25, with no commas and at most six decimals'],
  ])('refuses the rate %j and sends nothing', async (rate, message) => {
    const user = userEvent.setup();
    renderWithProviders(<CurrenciesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add currency' }));
    await user.type(screen.getByLabelText('Code'), 'EUR');
    await user.type(screen.getByLabelText('Name'), 'Euro');
    await user.type(screen.getByLabelText('Symbol'), '€');
    await user.type(screen.getByLabelText('Rate'), rate);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('changes a rate with PATCH, starting from the current one', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<CurrenciesPage />);
    await user.click(await screen.findByRole('button', { name: 'Edit Indian rupee' }));
    const rate = screen.getByLabelText('Rate');
    expect(rate).toHaveValue('88.25');
    await user.clear(rate);
    await user.type(rate, '90');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.patch).toHaveBeenCalledWith('/currencies/2', {
        code: 'INR',
        name: 'Indian rupee',
        symbol: '₹',
        rate: 90,
      }),
    );
  });

  it('says why a duplicate code was refused', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(rejection(409, 'A record with the same unique value already exists'));
    const user = userEvent.setup();
    renderWithProviders(<CurrenciesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add currency' }));
    await user.type(screen.getByLabelText('Code'), 'INR');
    await user.type(screen.getByLabelText('Name'), 'Rupee');
    await user.type(screen.getByLabelText('Symbol'), '₹');
    await user.type(screen.getByLabelText('Rate'), '88');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('A record with the same unique value already exists')).toBeInTheDocument();
  });

  it('deletes a currency after the confirmation', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<CurrenciesPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete Indian rupee' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('A currency that an expense uses cannot be deleted.');
    await user.click(screen.getByRole('button', { name: 'Delete currency' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/currencies/2'));
  });

  it('offers a way to try again when the service is down', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(new Error('down'));
    renderWithProviders(<CurrenciesPage />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
