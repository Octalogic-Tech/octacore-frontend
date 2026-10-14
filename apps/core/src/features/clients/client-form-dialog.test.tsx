import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import { clientRows, contactRows, createdClientEnvelope } from '@/test/fixtures/clients';
import { countriesEnvelope } from '@/test/fixtures/countries';
import { renderWithProviders } from '@/test/utils';
import { ClientFormDialog } from './client-form-dialog';
import { clientRowsSchema, contactRowsSchema, type ClientRow, type ContactRow } from './schema';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const [acme, globex] = clientRowsSchema.parse(clientRows);
const [ada] = contactRowsSchema.parse(contactRows);

const onOpenChange = vi.fn();

const CONTACT_NOT_SAVED = 'The client was saved, but its contact was not. Try again.';
// A retry repeats the same call and fails the same way, so this one does not say "Try again".
const CHANGED_ELSEWHERE =
  'The client was saved, but its contact was not: the contact changed elsewhere. Close this dialog and open the client again.';

/** What the service answers a save with; the dialog does not read it. */
const saved = { data: { statusCode: 200, message: 'saved', data: {}, meta: null } };

function openDialog(props: { client?: ClientRow; contact?: ContactRow } = {}) {
  return renderWithProviders(<ClientFormDialog open onOpenChange={onOpenChange} {...props} />);
}

beforeEach(() => {
  vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
    if (path === '/countries') return { data: countriesEnvelope() };
    throw new Error(`unexpected GET ${path}`);
  }) as never);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('ClientFormDialog: adding', () => {
  it('creates the client, then its contact under the id the service gave the client', async () => {
    vi.mocked(coreApi.post).mockImplementation((async (path: string) =>
      path === '/clients' ? { data: createdClientEnvelope(7) } : saved) as never);
    const user = userEvent.setup();
    openDialog();
    expect(screen.getByRole('dialog', { name: 'New client' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), 'Hooli');
    await user.type(screen.getByLabelText('Description'), 'Search and more.');
    await screen.findByRole('option', { name: 'India' });
    await user.selectOptions(screen.getByLabelText('Country'), 'India');
    await user.type(screen.getByLabelText('City'), 'Palo Alto');
    await user.type(screen.getByLabelText('Contact name'), 'Gavin Belson');
    await user.type(screen.getByLabelText('Email'), 'gavin@hooli.example');
    await user.type(screen.getByLabelText('Phone'), '+1 650 555 0100');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledTimes(2);
    expect(coreApi.post).toHaveBeenNthCalledWith(1, '/clients', {
      name: 'Hooli',
      description: 'Search and more.',
      countryId: 99,
      city: 'Palo Alto',
    });
    expect(coreApi.post).toHaveBeenNthCalledWith(2, '/client-contacts', {
      clientId: 7,
      name: 'Gavin Belson',
      email: 'gavin@hooli.example',
      phone: '+1 650 555 0100',
    });
  });

  it('creates only the client, with nulls, when the contact group is empty', async () => {
    vi.mocked(coreApi.post).mockResolvedValue({ data: createdClientEnvelope(7) });
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Name'), 'Hooli');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledTimes(1);
    expect(coreApi.post).toHaveBeenCalledWith('/clients', {
      name: 'Hooli',
      description: null,
      countryId: null,
      city: null,
    });
  });

  it('treats a contact group of only spaces as empty', async () => {
    vi.mocked(coreApi.post).mockResolvedValue({ data: createdClientEnvelope(7) });
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Name'), 'Hooli');
    await user.type(screen.getByLabelText('Contact name'), '   ');
    await user.type(screen.getByLabelText('Phone'), '  ');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledTimes(1);
  });

  it('blocks a client without a name', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('blocks a contact with an email or a phone but no name, and a bad email', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Name'), 'Hooli');
    await user.type(screen.getByLabelText('Phone'), '123');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Contact name is required')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Contact name'), 'Gavin');
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });
});

describe('ClientFormDialog: editing', () => {
  it('opens on the client and its contact', () => {
    openDialog({ client: acme, contact: ada });
    expect(screen.getByRole('dialog', { name: 'Edit client' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Acme');
    expect(screen.getByLabelText('Description')).toHaveValue('Anvils and rockets.');
    expect(screen.getByLabelText('Country')).toHaveValue('99');
    expect(screen.getByLabelText('City')).toHaveValue('Pune');
    expect(screen.getByLabelText('Contact name')).toHaveValue('Ada Lovelace');
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
    expect(screen.getByLabelText('Phone')).toHaveValue('+91 20 5550 0100');
  });

  it('patches the client and its contact', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ client: acme, contact: ada });
    await user.clear(screen.getByLabelText('Phone'));
    await user.type(screen.getByLabelText('Phone'), '+91 20 5550 0199');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).not.toHaveBeenCalled();
    expect(coreApi.patch).toHaveBeenNthCalledWith(1, '/clients/1', {
      name: 'Acme',
      description: 'Anvils and rockets.',
      countryId: 99,
      city: 'Pune',
    });
    expect(coreApi.patch).toHaveBeenNthCalledWith(2, '/client-contacts/1', {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '+91 20 5550 0199',
    });
  });

  it('sends null for fields that were cleared, so they are cleared on the service', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ client: acme, contact: ada });
    await user.clear(screen.getByLabelText('Description'));
    await user.clear(screen.getByLabelText('City'));
    await user.selectOptions(screen.getByLabelText('Country'), 'None');
    await user.clear(screen.getByLabelText('Email'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenNthCalledWith(1, '/clients/1', {
      name: 'Acme',
      description: null,
      countryId: null,
      city: null,
    });
    expect(coreApi.patch).toHaveBeenNthCalledWith(2, '/client-contacts/1', {
      name: 'Ada Lovelace',
      email: null,
      phone: '+91 20 5550 0100',
    });
  });

  it('adds a contact to a client that has none', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ client: globex });
    await user.type(screen.getByLabelText('Contact name'), 'Hank Scorpio');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/clients/2', {
      name: 'Globex',
      description: null,
      countryId: null,
      city: null,
    });
    expect(coreApi.post).toHaveBeenCalledTimes(1);
    expect(coreApi.post).toHaveBeenCalledWith('/client-contacts', {
      clientId: 2,
      name: 'Hank Scorpio',
      email: null,
      phone: null,
    });
  });

  it('deletes the contact when its group is cleared', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ client: acme, contact: ada });
    await user.clear(screen.getByLabelText('Contact name'));
    await user.clear(screen.getByLabelText('Email'));
    await user.clear(screen.getByLabelText('Phone'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.delete).toHaveBeenCalledWith('/client-contacts/1');
    expect(coreApi.patch).toHaveBeenCalledTimes(1);
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('opens on None for a client whose country the service no longer lists, and saves null', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ client: { ...acme, countryName: '' }, contact: ada });
    expect(screen.getByLabelText('Country')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenNthCalledWith(1, '/clients/1', {
      name: 'Acme',
      description: 'Anvils and rockets.',
      countryId: null,
      city: 'Pune',
    });
  });

  it('keeps the client country when the countries cannot be loaded', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(new Error('down'));
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ client: acme, contact: ada });
    expect(await screen.findByText('Countries could not be loaded.')).toBeInTheDocument();
    expect(screen.getByLabelText('Country')).toHaveValue('99');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenNthCalledWith(1, '/clients/1', expect.objectContaining({ countryId: 99 }));
  });
});

describe('ClientFormDialog: failures', () => {
  it('says so when the client did not save, and does not try the contact', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Name'), 'Hooli');
    await user.type(screen.getByLabelText('Contact name'), 'Gavin');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('That did not save. Try again.')).toBeInTheDocument();
    expect(coreApi.post).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('after the client saved but its contact did not, a retry never creates a second client and keeps new edits', async () => {
    vi.mocked(coreApi.post)
      .mockResolvedValueOnce({ data: createdClientEnvelope(7) })
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(saved);
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Name'), 'Hooli');
    await user.type(screen.getByLabelText('Contact name'), 'Gavin Belson');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('The client was saved, but its contact was not. Try again.')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Name'), ' Inc');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

    const clientPosts = vi.mocked(coreApi.post).mock.calls.filter(([path]) => path === '/clients');
    expect(clientPosts).toHaveLength(1);
    expect(coreApi.patch).toHaveBeenCalledWith('/clients/7', {
      name: 'Hooli Inc',
      description: null,
      countryId: null,
      city: null,
    });
    expect(coreApi.post).toHaveBeenLastCalledWith('/client-contacts', {
      clientId: 7,
      name: 'Gavin Belson',
      email: null,
      phone: null,
    });
  });

  it('says the contact changed elsewhere, not "try again", when the service refuses a second contact for the client', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    vi.mocked(coreApi.post).mockRejectedValue({ response: { status: 409 } });
    const user = userEvent.setup();
    openDialog({ client: globex });
    await user.type(screen.getByLabelText('Contact name'), 'Hank Scorpio');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(CHANGED_ELSEWHERE)).toBeInTheDocument();
    expect(screen.queryByText(CONTACT_NOT_SAVED)).not.toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it.each([
    ['updating', { client: acme, contact: ada }, 'Phone', '123'],
    ['removing', { client: acme, contact: ada }, 'clear', ''],
  ])('says the contact changed elsewhere when %s a contact that was removed in another tab', async (_label, props, field, text) => {
    vi.mocked(coreApi.patch)
      .mockResolvedValueOnce(saved)
      .mockRejectedValueOnce({ response: { status: 404 } });
    vi.mocked(coreApi.delete).mockRejectedValue({ response: { status: 404 } });
    const user = userEvent.setup();
    openDialog(props);
    if (field === 'clear') {
      await user.clear(screen.getByLabelText('Contact name'));
      await user.clear(screen.getByLabelText('Email'));
      await user.clear(screen.getByLabelText('Phone'));
    } else {
      await user.clear(screen.getByLabelText(field));
      await user.type(screen.getByLabelText(field), text);
    }
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(CHANGED_ELSEWHERE)).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('cannot be dismissed while a save is running, so a failure is not lost', async () => {
    let fail!: (error: Error) => void;
    vi.mocked(coreApi.post).mockImplementation(
      (() =>
        new Promise((_, reject) => {
          fail = reject;
        })) as never,
    );
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Name'), 'Hooli');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();
    fail(new Error('down'));
    expect(await screen.findByText('That did not save. Try again.')).toBeInTheDocument();
  });
});
