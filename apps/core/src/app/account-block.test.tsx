import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import type { AuthContextValue } from '@/features/auth/auth-context';
import { AuthTestProvider } from '@/test/auth';
import { adminUser } from '@/test/fixtures/users';
import { AccountBlock } from './account-block';

const rejection = (status: number, message: string) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, {
    status,
    data: { statusCode: status, message, data: null },
  } as AxiosResponse);

function renderBlock(value: Partial<AuthContextValue> = {}) {
  return render(
    <AuthTestProvider value={value}>
      <AccountBlock />
    </AuthTestProvider>,
  );
}

type User = ReturnType<typeof userEvent.setup>;

const trigger = () => screen.getByRole('button', { name: 'Ada Admin' });

async function openMenu(user: User) {
  await user.click(trigger());
  return screen.findByRole('dialog', { name: 'Account options' });
}

async function openDialog(user: User) {
  const menu = await openMenu(user);
  await user.click(within(menu).getByRole('button', { name: 'Change password' }));
  return screen.findByRole('dialog', { name: 'Change password' });
}

describe('AccountBlock', () => {
  it('shows only the name and an initials avatar, with the email and the actions out of sight', () => {
    renderBlock();
    const account = screen.getByRole('region', { name: 'Account' });
    expect(within(account).getByText('Ada Admin')).toBeInTheDocument();
    expect(within(account).getByText('AA')).toHaveAttribute('aria-hidden', 'true');
    expect(within(account).queryByText('Signed in as')).not.toBeInTheDocument();
    expect(screen.queryByText('ada@example.com')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change password' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it.each([
    ['Ada Admin', 'AA'],
    ['Grace Murray Hopper', 'GH'],
    ['Madonna', 'M'],
    ['  linus   torvalds ', 'LT'],
  ])('draws the initials of %s as %s', (name, initials) => {
    renderBlock({ user: { ...adminUser, name } });
    expect(screen.getByText(initials)).toBeInTheDocument();
  });

  it('shows nothing when nobody is signed in', () => {
    renderBlock({ status: 'anonymous', user: null });
    expect(screen.queryByRole('region', { name: 'Account' })).not.toBeInTheDocument();
  });

  it('opens a popover with the email, Change password and Sign out', async () => {
    const user = userEvent.setup();
    renderBlock();
    const menu = await openMenu(user);
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(within(menu).getByText('ada@example.com')).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: 'Change password' })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('closes on Escape and puts focus back on the name', async () => {
    const user = userEvent.setup();
    renderBlock();
    await openMenu(user);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('gives each name button its own id, since the sidebar and the phone menu can both show one', () => {
    render(
      <AuthTestProvider>
        <AccountBlock />
        <AccountBlock />
      </AuthTestProvider>,
    );
    const ids = screen.getAllByRole('button', { name: 'Ada Admin' }).map((button) => button.id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('signs out', async () => {
    const signOut = vi.fn(async () => undefined);
    const user = userEvent.setup();
    renderBlock({ signOut });
    const menu = await openMenu(user);
    await user.click(within(menu).getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('closes the popover when Change password opens its dialog, and returns focus to the name when that closes', async () => {
    const user = userEvent.setup();
    renderBlock();
    const dialog = await openDialog(user);
    expect(screen.queryByRole('dialog', { name: 'Account options' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger()).toHaveFocus();
  });

  it('opens a dialog with the three password fields', async () => {
    const user = userEvent.setup();
    renderBlock();
    const dialog = await openDialog(user);
    expect(within(dialog).getByLabelText('Current password')).toHaveAttribute('type', 'password');
    expect(within(dialog).getByLabelText('New password')).toHaveAttribute('type', 'password');
    expect(within(dialog).getByLabelText('Confirm new password')).toHaveAttribute('type', 'password');
  });

  it('says what is missing and does not call the service', async () => {
    const changePassword = vi.fn();
    const user = userEvent.setup();
    renderBlock({ changePassword });
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText('New password'), 'short');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('Current password is required')).toBeInTheDocument();
    expect(within(dialog).getByText('Use at least 10 characters')).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('says when the two new passwords differ and does not call the service', async () => {
    const changePassword = vi.fn();
    const user = userEvent.setup();
    renderBlock({ changePassword });
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText('Current password'), 'old password 1');
    await user.type(within(dialog).getByLabelText('New password'), 'a brand new passphrase');
    await user.type(within(dialog).getByLabelText('Confirm new password'), 'a different passphrase');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('The passwords do not match')).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('changes the password and closes', async () => {
    const changePassword = vi.fn(async () => undefined);
    const user = userEvent.setup();
    renderBlock({ changePassword });
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText('Current password'), 'old password 1');
    await user.type(within(dialog).getByLabelText('New password'), 'a brand new passphrase');
    await user.type(within(dialog).getByLabelText('Confirm new password'), 'a brand new passphrase');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(changePassword).toHaveBeenCalledWith('old password 1', 'a brand new passphrase'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it("shows the service's message when the current password is wrong, and stays open", async () => {
    const user = userEvent.setup();
    renderBlock({ changePassword: vi.fn().mockRejectedValue(rejection(422, 'Current password is incorrect')) });
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText('Current password'), 'not mine');
    await user.type(within(dialog).getByLabelText('New password'), 'a brand new passphrase');
    await user.type(within(dialog).getByLabelText('Confirm new password'), 'a brand new passphrase');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('Current password is incorrect')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Change password' })).toBeInTheDocument();
  });

  it('says it did not save for any other failure', async () => {
    const user = userEvent.setup();
    renderBlock({ changePassword: vi.fn().mockRejectedValue(rejection(500, 'Internal server error')) });
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText('Current password'), 'old password 1');
    await user.type(within(dialog).getByLabelText('New password'), 'a brand new passphrase');
    await user.type(within(dialog).getByLabelText('Confirm new password'), 'a brand new passphrase');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('That did not save. Try again.')).toBeInTheDocument();
  });
});
