import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthTestProvider } from '@/test/auth';
import type { AuthContextValue } from './auth-context';
import { LoginPage } from './login-page';

const rejection = (status: number) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, { status, data: {} } as AxiosResponse);

function Where() {
  const { pathname, search } = useLocation();
  return (
    <p>
      at {pathname}
      {search}
    </p>
  );
}

type Entry = string | { pathname: string; state?: unknown };

function renderLogin(value: Partial<AuthContextValue> = {}, entry: Entry = '/login') {
  return render(
    <AuthTestProvider value={{ status: 'anonymous', user: null, ...value }}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AuthTestProvider>,
  );
}

describe('LoginPage', () => {
  it('asks for an email and a password, with no navigation around it', () => {
    renderLogin();
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('shows a neutral blank, and no form, while the session is being restored', () => {
    const { container } = renderLogin({ status: 'loading' });
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('says what is missing and does not call the service', async () => {
    const signIn = vi.fn();
    const user = userEvent.setup();
    renderLogin({ signIn });
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('signs in with the trimmed email and the password exactly as typed', async () => {
    const signIn = vi.fn(async () => undefined);
    const user = userEvent.setup();
    renderLogin({ signIn });
    await user.type(screen.getByLabelText('Email'), '  ada@example.com ');
    await user.type(screen.getByLabelText('Password'), ' secret ');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('ada@example.com', ' secret '));
  });

  it('says the email or password is wrong after a 401', async () => {
    const user = userEvent.setup();
    renderLogin({ signIn: vi.fn().mockRejectedValue(rejection(401)) });
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });

  it('treats a 422 from the service like a failed credential check', async () => {
    const user = userEvent.setup();
    renderLogin({ signIn: vi.fn().mockRejectedValue(rejection(422)) });
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
  });

  it('refuses a password longer than 128 characters before calling the service', async () => {
    const signIn = vi.fn();
    const user = userEvent.setup();
    renderLogin({ signIn });
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.click(screen.getByLabelText('Password'));
    await user.paste('x'.repeat(129));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Use at most 128 characters')).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('drops the old "Invalid email or password" when the form is sent again with a field missing', async () => {
    const user = userEvent.setup();
    renderLogin({ signIn: vi.fn().mockRejectedValue(rejection(401)) });
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    await user.clear(screen.getByLabelText('Password'));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Password is required')).toBeInTheDocument();
    expect(screen.queryByText('Invalid email or password.')).not.toBeInTheDocument();
  });

  it('says the service could not be reached for any other failure', async () => {
    const user = userEvent.setup();
    renderLogin({ signIn: vi.fn().mockRejectedValue(rejection(500)) });
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not sign you in');
  });

  it('says when the last sign-out could not reach the service', () => {
    window.localStorage.setItem('octacore.pendingLogout', '1');
    try {
      renderLogin();
      expect(screen.getByText(/We could not reach the service to end your last session/)).toBeInTheDocument();
    } finally {
      window.localStorage.clear();
    }
  });

  it('says nothing about the last session when it ended normally', () => {
    renderLogin();
    expect(screen.queryByText(/end your last session/)).not.toBeInTheDocument();
  });

  it('disables the button while signing in', async () => {
    const user = userEvent.setup();
    renderLogin({ signIn: vi.fn(() => new Promise<void>(() => undefined)) });
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled());
  });

  it('sends a signed-in person to the page they were going to, query string included', () => {
    renderLogin(
      { status: 'authenticated' },
      { pathname: '/login', state: { from: { pathname: '/users', search: '?q=ada' } } },
    );
    expect(screen.getByText('at /users?q=ada')).toBeInTheDocument();
  });

  it('sends a signed-in person with no saved page to the overview', () => {
    renderLogin({ status: 'authenticated' });
    expect(screen.getByText('at /')).toBeInTheDocument();
  });

  it('does not loop when the saved page is the login page itself', () => {
    renderLogin({ status: 'authenticated' }, { pathname: '/login', state: { from: { pathname: '/login', search: '' } } });
    expect(screen.getByText('at /')).toBeInTheDocument();
  });
});
