import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { coreApi, refreshSession } from '@/lib/core-api';
import { AuthTestProvider } from '@/test/auth';
import { userRows, usersEnvelope } from '@/test/fixtures/users';
import { renderWithProviders } from '@/test/utils';
import { UsersPage } from './users-page';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  refreshSession: vi.fn(),
}));

const serve = (rows: unknown = userRows) => vi.mocked(coreApi.get).mockResolvedValue({ data: usersEnvelope(rows) });

/** What the service answers a save with; the page does not read it. */
const saved = { data: { statusCode: 200, message: 'saved', data: userRows[1], meta: null } };

const rejection = (status: number, message: string) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, {
    status,
    data: { statusCode: status, message, data: null },
  } as AxiosResponse);

const renderPage = () =>
  renderWithProviders(
    <AuthTestProvider>
      <UsersPage />
    </AuthTestProvider>,
  );

const rowOf = async (name: string) => within((await screen.findByText(name)).closest('tr') as HTMLElement);

beforeEach(() => {
  serve();
  vi.mocked(refreshSession).mockResolvedValue({ accessToken: 'again', expiresIn: 900, user: userRows[0] });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('UsersPage', () => {
  it('asks the core service for the users, not the mock API', async () => {
    renderPage();
    await screen.findByText('Grace Hopper');
    expect(coreApi.get).toHaveBeenCalledWith('/users');
  });

  it('lists name, email, role, last sign-in and created date', async () => {
    renderPage();
    const grace = await rowOf('Grace Hopper');
    expect(grace.getByText('grace@example.com')).toBeInTheDocument();
    expect(grace.getByText('admin')).toBeInTheDocument();
    expect(grace.getByText('Never')).toBeInTheDocument();
    expect(grace.getByText('5 Oct 2026')).toBeInTheDocument();
    const ada = await rowOf('Ada Admin');
    expect(ada.getAllByText('15 Oct 2026').length).toBeGreaterThan(0);
  });

  it('filters by name or email and says when nothing matches', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Grace Hopper');
    await user.type(screen.getByLabelText('Search users'), 'grace@');
    expect(screen.queryByText('Ada Admin')).not.toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Search users'));
    await user.type(screen.getByLabelText('Search users'), 'zzz');
    expect(screen.getByText('No users match “zzz”.')).toBeInTheDocument();
  });

  it('says it could not load the users and offers a retry', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(new Error('down'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('creates a user from the dialog with all four fields', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add user' }));
    await user.type(screen.getByLabelText('Name'), 'Linus Torvalds');
    await user.type(screen.getByLabelText('Email'), 'linus@example.com');
    await user.type(screen.getByLabelText('Password'), 'a long enough password');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith('/users', {
        name: 'Linus Torvalds',
        email: 'linus@example.com',
        role: 'admin',
        password: 'a long enough password',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('says what is missing and sends nothing', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add user' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Use at least 10 characters')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('says the email is already in use, in words for people, and keeps the dialog open', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(rejection(409, 'A record with the same unique value already exists'));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add user' }));
    await user.type(screen.getByLabelText('Name'), 'Dup');
    await user.type(screen.getByLabelText('Email'), 'grace@example.com');
    await user.type(screen.getByLabelText('Password'), 'a long enough password');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('A user with that email already exists')).toBeInTheDocument();
  });

  it('says the email is already in use when an edit collides with another user', async () => {
    vi.mocked(coreApi.patch).mockRejectedValue(rejection(409, 'A record with the same unique value already exists'));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit Grace Hopper' }));
    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('A user with that email already exists')).toBeInTheDocument();
  });

  it("shows the service's own words for any other conflict", async () => {
    vi.mocked(coreApi.patch).mockRejectedValue(rejection(409, 'The last admin cannot be changed'));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit Grace Hopper' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('The last admin cannot be changed')).toBeInTheDocument();
  });

  it('says it did not save when the service answers with its generic validation failure', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(rejection(422, 'Validation failed'));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add user' }));
    await user.type(screen.getByLabelText('Name'), 'Linus');
    await user.type(screen.getByLabelText('Email'), 'linus@example.com');
    await user.type(screen.getByLabelText('Password'), 'a long enough password');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('That did not save. Try again.')).toBeInTheDocument();
    expect(screen.queryByText('Validation failed')).not.toBeInTheDocument();
  });

  it('says it did not save for any other failure', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(rejection(500, 'Internal server error'));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add user' }));
    await user.type(screen.getByLabelText('Name'), 'Linus');
    await user.type(screen.getByLabelText('Email'), 'linus@example.com');
    await user.type(screen.getByLabelText('Password'), 'a long enough password');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('That did not save. Try again.')).toBeInTheDocument();
  });

  it('edits a user, leaving the password out when it is left blank', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit Grace Hopper' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Grace Hopper');
    expect(screen.getByLabelText('New password')).toHaveValue('');
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Rear Admiral Hopper');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.patch).toHaveBeenCalledWith('/users/2', {
        name: 'Rear Admiral Hopper',
        email: 'grace@example.com',
        role: 'admin',
      }),
    );
  });

  it('sends a new password when one is typed, and rejects one that is too short', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit Grace Hopper' }));
    await user.type(screen.getByLabelText('New password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Use 10 to 128 characters/)).toBeInTheDocument();
    expect(coreApi.patch).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('New password'));
    await user.type(screen.getByLabelText('New password'), 'a brand new passphrase');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.patch).toHaveBeenCalledWith('/users/2', {
        name: 'Grace Hopper',
        email: 'grace@example.com',
        role: 'admin',
        password: 'a brand new passphrase',
      }),
    );
  });

  it('deletes a user after a confirmation', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Delete Grace Hopper' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete user “Grace Hopper”?');
    await user.click(within(confirm).getByRole('button', { name: 'Delete user' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/users/2'));
  });

  it('does not let you delete your own account', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'Delete Ada Admin' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete Grace Hopper' })).toBeEnabled();
  });

  it('does not offer a password field on your own row, and points to Change password instead', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit Ada Admin' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText('New password')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Use Change password to change your own password.')).toBeInTheDocument();
  });

  it('after saving your own row, refreshes the session so the sidebar shows the new details', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit Ada Admin' }));
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Ada Lovelace');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.patch).toHaveBeenCalledWith('/users/1', { name: 'Ada Lovelace', email: 'ada@example.com', role: 'admin' }),
    );
    await waitFor(() => expect(refreshSession).toHaveBeenCalledTimes(1));
  });

  it('does not refresh the session after saving someone else', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit Grace Hopper' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(refreshSession).not.toHaveBeenCalled();
  });
});
