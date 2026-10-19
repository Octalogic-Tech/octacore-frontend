import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import { countriesEnvelope, countryRows } from '@/test/fixtures/countries';
import { expensesEnvelope, rejection } from '@/test/fixtures/expenses';
import { renderWithProviders } from '@/test/utils';
import { CountriesPage } from './countries-page';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const saved = { data: expensesEnvelope({}) };
const synced = (result: object) => ({ data: expensesEnvelope(result) });

beforeEach(() => {
  vi.mocked(coreApi.get).mockResolvedValue({ data: countriesEnvelope() });
});

afterEach(() => {
  vi.resetAllMocks();
});

const rowOf = (name: string) =>
  screen.getByText(name).closest('tr') as HTMLElement;

describe('CountriesPage: the list', () => {
  it('asks the core service for the countries, not the mock API', async () => {
    renderWithProviders(<CountriesPage />);
    await screen.findByText('Afghanistan');
    expect(coreApi.get).toHaveBeenCalledWith('/countries');
  });

  it('lists a country with its ISO code, currency, rate per US dollar, tax rate and whether it is active', async () => {
    renderWithProviders(<CountriesPage />);
    await screen.findByText('Afghanistan');
    await userEvent.type(screen.getByLabelText('Search countries'), 'india');
    const row = rowOf('India');
    expect(within(row).getByText('IN')).toBeInTheDocument();
    expect(within(row).getByText('INR')).toBeInTheDocument();
    expect(within(row).getByText('₹')).toBeInTheDocument();
    expect(within(row).getByText('88.25')).toBeInTheDocument();
    expect(within(row).getByText('18%')).toBeInTheDocument();
    expect(within(row).getByText('Active')).toBeInTheDocument();
  });

  it('no longer lists the ISO3, numeric and calling codes', async () => {
    renderWithProviders(<CountriesPage />);
    await screen.findByText('Afghanistan');
    expect(
      screen.queryByRole('columnheader', { name: /ISO3|Numeric|Phone/ })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('AFG')).not.toBeInTheDocument();
    expect(screen.queryByText('+93')).not.toBeInTheDocument();
  });

  it('shows 1 for US dollars, and a dash where there is no rate yet', async () => {
    renderWithProviders(<CountriesPage />);
    await screen.findByText('Afghanistan');
    await userEvent.type(
      screen.getByLabelText('Search countries'),
      'united states'
    );
    expect(within(rowOf('United States')).getByText('1')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Search countries'));
    await userEvent.type(screen.getByLabelText('Search countries'), 'japan');
    expect(within(rowOf('Japan')).getByText('—')).toBeInTheDocument();
  });

  it('marks an inactive country with an outlined Inactive badge', async () => {
    renderWithProviders(<CountriesPage />);
    const row = (await screen.findByText('Afghanistan')).closest(
      'tr'
    ) as HTMLElement;
    expect(within(row).getByText('Inactive')).toBeInTheDocument();
    expect(within(row).queryByText('Active')).not.toBeInTheDocument();
  });

  it('lists the countries A to Z, whatever order the service sends them in', async () => {
    vi.mocked(coreApi.get).mockResolvedValue({
      data: countriesEnvelope([...countryRows].reverse()),
    });
    renderWithProviders(<CountriesPage />);
    await screen.findByText('Afghanistan');
    const names = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[0].textContent);
    expect(names[0]).toBe('Afghanistan');
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(screen.getByText('1–10 of 12')).toBeInTheDocument();
  });

  it('gives each row an edit and a delete icon button that name the country', async () => {
    renderWithProviders(<CountriesPage />);
    const row = (await screen.findByText('Afghanistan')).closest(
      'tr'
    ) as HTMLElement;
    expect(
      within(row).getByRole('button', { name: 'Edit Afghanistan' })
    ).toBeInTheDocument();
    expect(
      within(row).getByRole('button', { name: 'Delete Afghanistan' })
    ).toBeInTheDocument();
  });

  it.each([
    ['a name, ignoring case', 'brazil', 'Brazil'],
    ['an ISO code', 'gb', 'United Kingdom'],
    ['an ISO3 code', 'GBR', 'United Kingdom'],
    ['a calling code', '44', 'United Kingdom'],
    ['a calling code typed with its plus', '+44', 'United Kingdom'],
    ['a currency code', 'jpy', 'Japan'],
    ['a currency name', 'rupee', 'India'],
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

  it('shows an error with a retry when the service is down, then recovers', async () => {
    vi.mocked(coreApi.get)
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue({ data: countriesEnvelope() });
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load this data'
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Afghanistan')).toBeInTheDocument();
  });

  it('shows an error, not a broken page, when the service answers in an unexpected shape', async () => {
    vi.mocked(coreApi.get).mockResolvedValue({
      data: [{ id: 1, nicename: 'Afghanistan' }],
    });
    renderWithProviders(<CountriesPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load this data'
    );
  });

  it('shows an error when the service still answers without the currency fields', async () => {
    const added = [
      'currencyCode',
      'currencyName',
      'currencySymbol',
      'rate',
      'taxRate',
      'active',
    ];
    const old = countryRows.map((row) =>
      Object.fromEntries(
        Object.entries(row).filter(([key]) => !added.includes(key))
      )
    );
    vi.mocked(coreApi.get).mockResolvedValue({ data: countriesEnvelope(old) });
    renderWithProviders(<CountriesPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load this data'
    );
  });

  it('says so when the list is empty, and offers to add the first country', async () => {
    vi.mocked(coreApi.get).mockResolvedValue({ data: countriesEnvelope([]) });
    renderWithProviders(<CountriesPage />);
    expect(await screen.findByText(/No countries yet/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add the first country' })
    ).toBeInTheDocument();
  });
});

describe('CountriesPage: the Active filter', () => {
  it('shows every country, or only the active ones', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await screen.findByText('Afghanistan');
    expect(screen.getByLabelText('Show')).toHaveValue('all');
    await user.selectOptions(screen.getByLabelText('Show'), 'Active countries');
    expect(screen.getByText('1–4 of 4')).toBeInTheDocument();
    for (const name of ['Germany', 'India', 'Japan', 'United States'])
      expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.queryByText('Afghanistan')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Show'), 'All countries');
    expect(screen.getByText('1–10 of 12')).toBeInTheDocument();
  });

  it('searches only the active ones while it is on', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await screen.findByText('Afghanistan');
    await user.selectOptions(screen.getByLabelText('Show'), 'Active countries');
    await user.type(screen.getByLabelText('Search countries'), 'united');
    expect(screen.getByText('United States')).toBeInTheDocument();
    expect(screen.queryByText('United Kingdom')).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText('Search countries'));
    await user.type(screen.getByLabelText('Search countries'), 'zzz');
    expect(
      screen.getByText('No active countries match “zzz”.')
    ).toBeInTheDocument();
  });

  it('says when no country is active', async () => {
    vi.mocked(coreApi.get).mockResolvedValue({
      data: countriesEnvelope(
        countryRows.map((row) => ({ ...row, active: false }))
      ),
    });
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await screen.findByText('Afghanistan');
    await user.selectOptions(screen.getByLabelText('Show'), 'Active countries');
    expect(
      screen.getByText('No country is active. Edit one to switch it on.')
    ).toBeInTheDocument();
  });

  it('goes back to the first page when the filter changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await user.selectOptions(screen.getByLabelText('Show'), 'Active countries');
    expect(screen.getByText('1–4 of 4')).toBeInTheDocument();
  });
});

async function fillNewCountry(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Add country' }));
  await user.type(screen.getByLabelText('Name'), 'Switzerland');
  await user.type(screen.getByLabelText('ISO code'), 'ch');
  await user.type(screen.getByLabelText('ISO3 code'), 'che');
  await user.type(screen.getByLabelText('Numeric code'), '756');
  await user.type(screen.getByLabelText('Calling code'), '41');
  await user.type(screen.getByLabelText('Currency code'), 'chf');
  await user.type(screen.getByLabelText('Currency name'), 'Swiss franc');
  await user.type(screen.getByLabelText('Currency symbol'), 'CHF');
}

describe('CountriesPage: adding', () => {
  it('adds a country with its numbers as numbers, typing the codes in capitals', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await fillNewCountry(user);
    expect(screen.getByLabelText('ISO code')).toHaveValue('CH');
    expect(screen.getByLabelText('ISO3 code')).toHaveValue('CHE');
    expect(screen.getByLabelText('Currency code')).toHaveValue('CHF');
    await user.type(screen.getByLabelText('Rate'), '0.88');
    await user.clear(screen.getByLabelText('Tax rate (%)'));
    await user.type(screen.getByLabelText('Tax rate (%)'), '7.7');
    await user.click(screen.getByRole('checkbox', { name: 'Active' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith('/countries', {
        iso: 'CH',
        nicename: 'Switzerland',
        iso3: 'CHE',
        numcode: 756,
        phonecode: 41,
        currencyCode: 'CHF',
        currencyName: 'Swiss franc',
        currencySymbol: 'CHF',
        rate: 0.88,
        taxRate: 7.7,
        active: true,
      })
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
  });

  it('starts switched off, with a tax rate of 0 and no rate, and sends no rate as null', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await fillNewCountry(user);
    expect(screen.getByRole('checkbox', { name: 'Active' })).not.toBeChecked();
    expect(screen.getByLabelText('Tax rate (%)')).toHaveValue('0');
    expect(screen.getByLabelText('Rate')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith(
        '/countries',
        expect.objectContaining({ rate: null, taxRate: 0, active: false })
      )
    );
  });

  it('lets a country with no ISO3, numeric or calling code be added: they are sent as empty and 0', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await user.click(
      await screen.findByRole('button', { name: 'Add country' })
    );
    await user.type(screen.getByLabelText('Name'), 'Atlantis');
    await user.type(screen.getByLabelText('ISO code'), 'AT');
    await user.type(screen.getByLabelText('Currency code'), 'ATL');
    await user.type(screen.getByLabelText('Currency name'), 'Atlantean pearl');
    await user.type(screen.getByLabelText('Currency symbol'), 'P');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith(
        '/countries',
        expect.objectContaining({ iso3: '', numcode: 0, phonecode: 0 })
      )
    );
  });

  it('locks the rate to 1 for US dollars, sends it as 1, and empties it again when the code changes', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await fillNewCountry(user);
    await user.clear(screen.getByLabelText('Currency code'));
    await user.type(screen.getByLabelText('Currency code'), 'usd');
    expect(screen.getByLabelText('Rate')).toHaveValue('1');
    expect(screen.getByLabelText('Rate')).toHaveAttribute('readonly');
    expect(screen.getByText('US dollars are always 1.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Currency code'), 'x');
    expect(screen.getByLabelText('Rate')).toHaveValue('');
    expect(screen.getByLabelText('Rate')).not.toHaveAttribute('readonly');
    await user.type(screen.getByLabelText('Rate'), '3');
    await user.clear(screen.getByLabelText('Currency code'));
    await user.type(screen.getByLabelText('Currency code'), 'USD');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith(
        '/countries',
        expect.objectContaining({ currencyCode: 'USD', rate: 1 })
      )
    );
  });

  it('blocks an empty form, telling what is missing, and sends nothing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await user.click(
      await screen.findByRole('button', { name: 'Add country' })
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(
      screen.getByText('Two capital letters, like IN')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Three capital letters, like EUR')
    ).toBeInTheDocument();
    expect(screen.getByText('Currency name is required')).toBeInTheDocument();
    expect(screen.getByText('Symbol is required')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it.each([
    [
      'Rate',
      '1,5',
      'Enter a rate like 88.25, with no commas and at most six decimals',
    ],
    ['Rate', '0', 'The rate must be more than zero'],
    ['Rate', '1000001', 'The rate is too large'],
    [
      'Tax rate (%)',
      '7.255',
      'Enter a tax rate like 18 or 7.25, with no commas and at most two decimals',
    ],
    ['Tax rate (%)', '101', 'The tax rate cannot be more than 100'],
    [
      'Numeric code',
      '1000',
      'The numeric code must be a whole number from 0 to 999',
    ],
    [
      'Calling code',
      '+91',
      'The calling code must be a whole number from 0 to 9999',
    ],
  ])('refuses %s %j and sends nothing', async (label, text, message) => {
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await fillNewCountry(user);
    await user.clear(screen.getByLabelText(label));
    await user.type(screen.getByLabelText(label), text);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('says why a duplicate ISO code was refused, and stays open', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(
      rejection(409, 'A record with the same unique value already exists')
    );
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await fillNewCountry(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText(
        'A record with the same unique value already exists'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: 'New country' })
    ).toBeInTheDocument();
  });

  it('says to try again when the save fails for another reason', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await fillNewCountry(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('That did not save. Try again.')
    ).toBeInTheDocument();
  });

  it('refreshes the countries, the recurring expenses, the expenses and the clients after a save', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    const { client } = renderWithProviders(<CountriesPage />);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await fillNewCountry(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['recurring-expenses'],
      })
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['countries'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['expenses'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['clients'] });
  });
});

describe('CountriesPage: editing', () => {
  async function openEdit(
    user: ReturnType<typeof userEvent.setup>,
    name: string
  ) {
    await screen.findByText('Afghanistan');
    await user.type(screen.getByLabelText('Search countries'), name);
    await user.click(
      await screen.findByRole('button', { name: `Edit ${name}` })
    );
  }

  it('starts from the country, a missing code as an empty field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await openEdit(user, 'India');
    expect(
      screen.getByRole('dialog', { name: 'Edit country' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('India');
    expect(screen.getByLabelText('ISO code')).toHaveValue('IN');
    expect(screen.getByLabelText('ISO3 code')).toHaveValue('IND');
    expect(screen.getByLabelText('Numeric code')).toHaveValue('356');
    expect(screen.getByLabelText('Calling code')).toHaveValue('91');
    expect(screen.getByLabelText('Currency code')).toHaveValue('INR');
    expect(screen.getByLabelText('Currency name')).toHaveValue('Indian rupee');
    expect(screen.getByLabelText('Currency symbol')).toHaveValue('₹');
    expect(screen.getByLabelText('Rate')).toHaveValue('88.25');
    expect(screen.getByLabelText('Tax rate (%)')).toHaveValue('18');
    expect(screen.getByRole('checkbox', { name: 'Active' })).toBeChecked();
  });

  it('changes a rate with PATCH, sending the whole country', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await openEdit(user, 'India');
    await user.clear(screen.getByLabelText('Rate'));
    await user.type(screen.getByLabelText('Rate'), '90');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.patch).toHaveBeenCalledWith('/countries/99', {
        iso: 'IN',
        nicename: 'India',
        iso3: 'IND',
        numcode: 356,
        phonecode: 91,
        currencyCode: 'INR',
        currencyName: 'Indian rupee',
        currencySymbol: '₹',
        rate: 90,
        taxRate: 18,
        active: true,
      })
    );
  });

  it('leaves the rate out of an edit that does not touch it, so a newer synced rate is not overwritten', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await openEdit(user, 'India');
    await user.clear(screen.getByLabelText('Tax rate (%)'));
    await user.type(screen.getByLabelText('Tax rate (%)'), '5');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalled());
    const [path, body] = vi.mocked(coreApi.patch).mock.calls[0];
    expect(path).toBe('/countries/99');
    expect(body).toMatchObject({
      taxRate: 5,
      currencyCode: 'INR',
      active: true,
    });
    expect(body).not.toHaveProperty('rate');
  });

  it('switches a country off', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await openEdit(user, 'India');
    await user.click(screen.getByRole('checkbox', { name: 'Active' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.patch).toHaveBeenCalledWith(
        '/countries/99',
        expect.objectContaining({ active: false })
      )
    );
  });

  it('clears the rate when the field is emptied', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await openEdit(user, 'India');
    await user.clear(screen.getByLabelText('Rate'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.patch).toHaveBeenCalledWith(
        '/countries/99',
        expect.objectContaining({ rate: null })
      )
    );
  });

  it('opens a dollar country with its rate locked at 1', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await openEdit(user, 'United States');
    expect(screen.getByLabelText('Rate')).toHaveValue('1');
    expect(screen.getByLabelText('Rate')).toHaveAttribute('readonly');
  });

  it('opens a country with no rate on an empty field, and the next country on its own values', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await openEdit(user, 'Japan');
    expect(screen.getByLabelText('Rate')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.clear(screen.getByLabelText('Search countries'));
    await user.type(screen.getByLabelText('Search countries'), 'India');
    await user.click(await screen.findByRole('button', { name: 'Edit India' }));
    expect(screen.getByLabelText('Rate')).toHaveValue('88.25');
  });

  it('shows the refusal to switch off the last US dollar country', async () => {
    vi.mocked(coreApi.patch).mockRejectedValue(
      rejection(409, 'At least one active country must use US dollars')
    );
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await openEdit(user, 'United States');
    await user.click(screen.getByRole('checkbox', { name: 'Active' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('At least one active country must use US dollars')
    ).toBeInTheDocument();
  });
});

describe('CountriesPage: deleting', () => {
  async function askToDelete(user: ReturnType<typeof userEvent.setup>) {
    await user.click(
      await screen.findByRole('button', { name: 'Delete Afghanistan' })
    );
  }

  it('deletes a country after the confirmation', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    const { client } = renderWithProviders(<CountriesPage />);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await askToDelete(user);
    expect(
      screen.getByRole('alertdialog', { name: 'Delete country “Afghanistan”?' })
    ).toHaveTextContent(
      'A country that a client, an expense or a recurring expense uses cannot be deleted.'
    );
    expect(coreApi.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete country' }));
    await waitFor(() =>
      expect(coreApi.delete).toHaveBeenCalledWith('/countries/1')
    );
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['recurring-expenses'],
      })
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['countries'] });
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    );
  });

  it('shows the service’s own message when the country is in use, and stays open', async () => {
    vi.mocked(coreApi.delete).mockRejectedValue(
      rejection(
        409,
        'The country is in use by a client, an expense or a recurring expense'
      )
    );
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await askToDelete(user);
    await user.click(screen.getByRole('button', { name: 'Delete country' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The country is in use by a client, an expense or a recurring expense'
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('shows the last-dollar-country message the same way', async () => {
    vi.mocked(coreApi.delete).mockRejectedValue(
      rejection(409, 'At least one active country must use US dollars')
    );
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await askToDelete(user);
    await user.click(screen.getByRole('button', { name: 'Delete country' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'At least one active country must use US dollars'
    );
  });

  it('says to try again when the delete fails for another reason', async () => {
    vi.mocked(coreApi.delete).mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await askToDelete(user);
    await user.click(screen.getByRole('button', { name: 'Delete country' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That did not work. Try again.'
    );
  });
});

describe('CountriesPage: syncing the rates', () => {
  const result = {
    date: '2026-10-19',
    updatedCountries: 31,
    updatedCurrencies: ['EUR', 'INR'],
    missingCurrencies: [],
  };

  it('asks the service to sync, with no body, and says how many rates changed and as of when', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(synced(result));
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Sync rates' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Updated 31 rates as of 2026-10-19.'
    );
    expect(coreApi.post).toHaveBeenCalledWith('/countries/sync-rates');
    expect(screen.queryByText(/No rate found/)).not.toBeInTheDocument();
  });

  it('says "1 rate" for one', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(
      synced({ ...result, updatedCountries: 1 })
    );
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Sync rates' }));
    expect(
      await screen.findByText('Updated 1 rate as of 2026-10-19.')
    ).toBeInTheDocument();
  });

  it('names the currencies the feed had no rate for', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(
      synced({ ...result, missingCurrencies: ['ZWG', 'XAF'] })
    );
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Sync rates' }));
    expect(
      await screen.findByText('No rate found for ZWG, XAF.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Updated 31 rates as of 2026-10-19.')
    ).toBeInTheDocument();
  });

  it('refreshes the countries, the recurring expenses, the expenses and the clients, so the new rates show', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(synced(result));
    const user = userEvent.setup();
    const { client } = renderWithProviders(<CountriesPage />);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await user.click(await screen.findByRole('button', { name: 'Sync rates' }));
    await screen.findByRole('status');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['countries'] });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['recurring-expenses'],
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['expenses'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['clients'] });
    await waitFor(() =>
      expect(
        vi
          .mocked(coreApi.get)
          .mock.calls.filter(([path]) => path === '/countries')
      ).toHaveLength(2)
    );
  });

  it('is disabled while the sync is on its way', async () => {
    let finish!: (value: ReturnType<typeof synced>) => void;
    vi.mocked(coreApi.post).mockReturnValue(
      new Promise((resolve) => (finish = resolve))
    );
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Sync rates' }));
    expect(screen.getByRole('button', { name: 'Syncing…' })).toBeDisabled();
    finish(synced(result));
    expect(
      await screen.findByRole('button', { name: 'Sync rates' })
    ).toBeEnabled();
  });

  it('says the exchange rate service could not be reached on a 502, and retries from there', async () => {
    vi.mocked(coreApi.post)
      .mockRejectedValueOnce(
        rejection(502, 'Could not reach the exchange rate service')
      )
      .mockResolvedValue(synced(result));
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Sync rates' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not reach the exchange rate service.'
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByText('Updated 31 rates as of 2026-10-19.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(coreApi.post).toHaveBeenCalledTimes(2);
  });

  it('says the rates could not be synced for any other failure, with the same retry', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Sync rates' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The rates could not be synced.'
    );
    expect(
      screen.getByRole('button', { name: 'Try again' })
    ).toBeInTheDocument();
  });

  it('shows a failure when the answer is not in the expected shape', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(synced({ date: '2026-10-19' }));
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Sync rates' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The rates could not be synced.'
    );
  });

  it('clears the last answer when it syncs again', async () => {
    vi.mocked(coreApi.post)
      .mockResolvedValueOnce(synced(result))
      .mockRejectedValueOnce(new Error('down'));
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Sync rates' }));
    await screen.findByRole('status');
    await user.click(screen.getByRole('button', { name: 'Sync rates' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
