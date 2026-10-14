import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import { clientRows, clientsEnvelope, contactRows, contactsEnvelope } from '@/test/fixtures/clients';
import { countriesEnvelope } from '@/test/fixtures/countries';
import { renderWithProviders } from '@/test/utils';
import { ClientsPage } from './clients-page';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

/** The next GETs answer with these bodies, in the service's envelope. */
const serve = (clients: unknown = clientsEnvelope(), contacts: unknown = contactsEnvelope()) =>
  vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
    if (path === '/clients') return { data: clients };
    if (path === '/client-contacts') return { data: contacts };
    if (path === '/countries') return { data: countriesEnvelope() };
    throw new Error(`unexpected GET ${path}`);
  }) as never);

/** What the service answers a delete with; the page does not read it. */
const saved = { data: { statusCode: 200, message: 'saved', data: clientRows[0], meta: null } };

const rowOf = async (name: string) => within((await screen.findByText(name)).closest('tr') as HTMLElement);

beforeEach(() => {
  serve();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('ClientsPage', () => {
  it('asks the core service for the clients and their contacts, not the mock API', async () => {
    renderWithProviders(<ClientsPage />);
    await screen.findByText('Acme');
    expect(coreApi.get).toHaveBeenCalledWith('/clients');
    expect(coreApi.get).toHaveBeenCalledWith('/client-contacts');
  });

  it('lists each client with its description, contact, country and city', async () => {
    renderWithProviders(<ClientsPage />);
    const acme = await rowOf('Acme');
    expect(acme.getByText('Anvils and rockets.')).toBeInTheDocument();
    expect(acme.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(acme.getByText('ada@example.com')).toBeInTheDocument();
    expect(acme.getByText('+91 20 5550 0100')).toBeInTheDocument();
    expect(acme.getByText('India')).toBeInTheDocument();
    expect(acme.getByText('Pune')).toBeInTheDocument();
    expect(screen.getByText('1–3 of 3')).toBeInTheDocument();
  });

  it('keeps a client that has no contact, country, city or description', async () => {
    renderWithProviders(<ClientsPage />);
    const globex = await rowOf('Globex');
    expect(globex.getAllByRole('cell').slice(0, 5).map((cell) => cell.textContent)).toEqual(['Globex', '', '', '', '']);
  });

  it('shows a contact that has only a phone', async () => {
    renderWithProviders(<ClientsPage />);
    const initech = await rowOf('Initech');
    expect(initech.getByText('Grace Hopper')).toBeInTheDocument();
    expect(initech.getByText('+44 20 7946 0001')).toBeInTheDocument();
    expect(initech.queryByText(/@/)).not.toBeInTheDocument();
  });

  it('shows an empty country for a client whose country the service no longer embeds', async () => {
    serve(clientsEnvelope([{ ...clientRows[0], country: null }]), contactsEnvelope([]));
    renderWithProviders(<ClientsPage />);
    const acme = await rowOf('Acme');
    expect(acme.queryByText('India')).not.toBeInTheDocument();
    expect(acme.getByText('Pune')).toBeInTheDocument();
  });

  it.each<[string, string, string[]]>([
    ['a name', 'acm', ['Acme']],
    ['a description', 'software', ['Initech']],
    ['a city', 'pune', ['Acme']],
    ['a country', 'united', ['Initech']],
    ['a contact name', 'grace', ['Initech']],
    ['a contact email', 'ada@example', ['Acme']],
  ])('searches %s', async (_label, query, expected) => {
    const user = userEvent.setup();
    renderWithProviders(<ClientsPage />);
    await screen.findByText('Acme');
    await user.type(screen.getByLabelText('Search clients'), query);
    for (const name of ['Acme', 'Globex', 'Initech']) {
      if (expected.includes(name)) expect(screen.getByText(name)).toBeInTheDocument();
      else expect(screen.queryByText(name)).not.toBeInTheDocument();
    }
  });

  it('says so when nothing matches the search', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientsPage />);
    await screen.findByText('Acme');
    await user.type(screen.getByLabelText('Search clients'), 'zzz');
    expect(screen.getByText('No clients match “zzz”.')).toBeInTheDocument();
  });

  it('offers to add the first client when there are none', async () => {
    serve(clientsEnvelope([]), contactsEnvelope([]));
    renderWithProviders(<ClientsPage />);
    expect(await screen.findByText('No clients yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add the first client' })).toBeInTheDocument();
  });

  it('opens the dialog empty to add a client', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientsPage />);
    await user.click(await screen.findByRole('button', { name: 'Add client' }));
    expect(screen.getByRole('dialog', { name: 'New client' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('opens the dialog on a client and its contact', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientsPage />);
    await user.click(await screen.findByRole('button', { name: 'Edit Acme' }));
    expect(screen.getByRole('dialog', { name: 'Edit client' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Acme');
    expect(screen.getByLabelText('Contact name')).toHaveValue('Ada Lovelace');
  });

  it('deletes only after the confirmation, and only the client', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<ClientsPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete Acme' }));
    expect(screen.getByText('Delete client “Acme”?')).toBeInTheDocument();
    expect(coreApi.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete client' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/clients/1'));
    expect(coreApi.delete).toHaveBeenCalledTimes(1);
  });

  it('moves focus to the search field after a delete removes the row that held it', async () => {
    vi.mocked(coreApi.delete).mockImplementation((async () => {
      serve(clientsEnvelope(clientRows.slice(1)), contactsEnvelope());
      return saved;
    }) as never);
    const user = userEvent.setup();
    renderWithProviders(<ClientsPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete Acme' }));
    await user.click(screen.getByRole('button', { name: 'Delete client' }));
    await waitFor(() => expect(screen.getByLabelText('Search clients')).toHaveFocus());
  });
});

describe('ClientsPage: failures', () => {
  it('shows an error with a retry when the clients request fails', async () => {
    vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
      if (path === '/clients') throw new Error('down');
      return { data: path === '/client-contacts' ? contactsEnvelope() : countriesEnvelope() };
    }) as never);
    renderWithProviders(<ClientsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows an error with a retry when the contacts request fails', async () => {
    vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
      if (path === '/client-contacts') throw new Error('down');
      return { data: path === '/clients' ? clientsEnvelope() : countriesEnvelope() };
    }) as never);
    renderWithProviders(<ClientsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
  });

  it.each([
    ['a bare array, which is what the json-server mock sends', clientRows, contactsEnvelope()],
    ['a client row that has lost its name', clientsEnvelope([{ ...clientRows[0], name: undefined }]), contactsEnvelope()],
    ['a contact row that has lost its client', clientsEnvelope(), contactsEnvelope([{ ...contactRows[0], clientId: undefined }])],
  ])('shows the error state, not a broken table, when the service answers with %s', async (_label, clients, contacts) => {
    serve(clients, contacts);
    renderWithProviders(<ClientsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
  });
});
