import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { coreApi } from '@/lib/core-api';
import { AuthTestProvider } from '@/test/auth';
import { envelope, fakeAdapter } from '@/test/fake-adapter';
import App from './app';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn().mockResolvedValue({ data: [] }), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const originalAdapter = coreApi.defaults.adapter;

// The core-service pages (Clients, Categories, Technologies, Countries) use coreApi: answer it here so no request leaves the test.
beforeEach(() => {
  coreApi.defaults.adapter = fakeAdapter(() => ({ status: 200, data: envelope([]) }));
});

afterEach(() => {
  coreApi.defaults.adapter = originalAdapter;
});

function renderAt(route: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthTestProvider>
        <MemoryRouter initialEntries={[route]}>
          <App />
        </MemoryRouter>
      </AuthTestProvider>
    </QueryClientProvider>,
  );
}

describe('App shell', () => {
  it('lists every page in four groups', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const label of ['Overview', 'Clients', 'Projects', 'Receipts and bills', 'Categories', 'Technologies', 'Countries', 'Users']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
    for (const group of ['Work', 'Finance', 'Reference data', 'Admin']) {
      expect(within(nav).getByText(group)).toBeInTheDocument();
    }
  });

  it('shows who is signed in, with Change password and Sign out', () => {
    renderAt('/');
    const account = screen.getByRole('region', { name: 'Account' });
    expect(within(account).getByText('Ada Admin')).toBeInTheDocument();
    expect(within(account).getByRole('button', { name: 'Change password' })).toBeInTheDocument();
    expect(within(account).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('marks only the current page', () => {
    renderAt('/projects');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Projects' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });

  it('keeps Projects current on a project page', () => {
    renderAt('/projects/1');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Projects' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name: 'Project' })).toBeInTheDocument();
  });

  it.each([
    ['/', 'Overview'],
    ['/clients', 'Clients'],
    ['/projects', 'Projects'],
    ['/finance/receipts-bills', 'Receipts and bills'],
    ['/categories', 'Categories'],
    ['/technologies', 'Technologies'],
    ['/countries', 'Countries'],
    ['/users', 'Users'],
  ])('shows the page title for %s', (route, title) => {
    renderAt(route);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });

  it('shows a not-found page inside the shell', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Overview' })).toHaveAttribute('href', '/');
  });

  it('offers a skip link to the main content', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it('links the logo to the overview', () => {
    renderAt('/categories');
    for (const link of screen.getAllByRole('link', { name: 'Octalogic Tech home' })) {
      expect(link).toHaveAttribute('href', '/');
    }
  });

  it('returns focus to the menu button when the menu is closed', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus());
  });

  it('opens the menu sheet and closes it after navigating', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const sheet = screen.getByRole('dialog', { name: 'Menu' });
    await user.click(within(sheet).getByRole('link', { name: 'Categories' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Categories' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
