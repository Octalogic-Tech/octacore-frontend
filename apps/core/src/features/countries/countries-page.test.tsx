import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import { countriesEnvelope } from '@/test/fixtures/countries';
import { renderWithProviders } from '@/test/utils';
import { CountriesPage } from './countries-page';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(coreApi.get).mockResolvedValue({ data: countriesEnvelope() });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('CountriesPage', () => {
  it('asks the core service for the countries, not the mock API', async () => {
    renderWithProviders(<CountriesPage />);
    await screen.findByText('Afghanistan');
    expect(coreApi.get).toHaveBeenCalledWith('/countries');
  });

  it('lists a country with its ISO codes, numeric code and calling code', async () => {
    renderWithProviders(<CountriesPage />);
    const row = (await screen.findByText('Afghanistan')).closest('tr') as HTMLElement;
    expect(within(row).getByText('AF')).toBeInTheDocument();
    expect(within(row).getByText('AFG')).toBeInTheDocument();
    expect(within(row).getByText('004')).toBeInTheDocument();
    expect(within(row).getByText('+93')).toBeInTheDocument();
    expect(screen.getByText('1–10 of 12')).toBeInTheDocument();
  });

  it('shows a dash where the data has no ISO3 code, numeric code or calling code', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await screen.findByText('Afghanistan');
    await user.type(screen.getByLabelText('Search countries'), 'antarctica');
    const row = screen.getByText('Antarctica').closest('tr') as HTMLElement;
    expect(within(row).getAllByText('—')).toHaveLength(3);
    // the service's seed data spells "no ISO3 code" as the text NULL; it must not reach the screen
    expect(within(row).queryByText('NULL')).not.toBeInTheDocument();
  });

  it('does not match the legacy NULL text when searching', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await screen.findByText('Afghanistan');
    await user.type(screen.getByLabelText('Search countries'), 'null');
    expect(screen.getByText('No countries match “null”.')).toBeInTheDocument();
  });

  it.each([
    ['a name, ignoring case', 'brazil', 'Brazil'],
    ['an ISO code', 'gb', 'United Kingdom'],
    ['an ISO3 code', 'GBR', 'United Kingdom'],
    ['a calling code', '44', 'United Kingdom'],
    ['a calling code typed with its plus', '+44', 'United Kingdom'],
  ])('finds a country by %s', async (_label, query, expected) => {
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await screen.findByText('Afghanistan');
    await user.type(screen.getByLabelText('Search countries'), query);
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.queryByText('Afghanistan')).not.toBeInTheDocument();
  });

  it('says when nothing matches', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await screen.findByText('Afghanistan');
    await user.type(screen.getByLabelText('Search countries'), 'zzz');
    expect(screen.getByText('No countries match “zzz”.')).toBeInTheDocument();
  });

  it('goes back to the first page when searching from a later page', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    expect(screen.getByText('11–12 of 12')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search countries'), 'japan');
    expect(screen.getByText('1–1 of 1')).toBeInTheDocument();
  });

  it('is read-only: the service has no way to change a country', async () => {
    renderWithProviders(<CountriesPage />);
    await screen.findByText('Afghanistan');
    expect(screen.queryByRole('button', { name: /add|edit|delete/i })).not.toBeInTheDocument();
  });

  it('shows an error with a retry when the service is down, then recovers', async () => {
    vi.mocked(coreApi.get).mockRejectedValueOnce(new Error('down')).mockResolvedValue({ data: countriesEnvelope() });
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Afghanistan')).toBeInTheDocument();
  });

  it('shows an error, not a broken page, when the service answers in an unexpected shape', async () => {
    vi.mocked(coreApi.get).mockResolvedValue({ data: [{ id: 1, nicename: 'Afghanistan' }] });
    renderWithProviders(<CountriesPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
  });

  it('says so when the list is empty', async () => {
    vi.mocked(coreApi.get).mockResolvedValue({ data: countriesEnvelope([]) });
    renderWithProviders(<CountriesPage />);
    expect(await screen.findByText(/No countries yet/)).toBeInTheDocument();
  });
});
