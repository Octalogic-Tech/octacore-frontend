import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { coreApi } from '@/lib/core-api';
import { AuthTestProvider } from '@/test/auth';
import { envelope, fakeAdapter } from '@/test/fake-adapter';
import { quoteEnvelope, quoteRows } from '@/test/fixtures/quotes';
import App from './app';

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
    for (const label of ['Overview', 'Clients', 'Projects', 'Quotes', 'People', 'Invoices', 'Expenses', 'Categories', 'Technologies', 'Countries', 'Expense types', 'Users']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
    for (const group of ['Work', 'Finance', 'Reference data', 'Admin']) {
      expect(within(nav).getByText(group)).toBeInTheDocument();
    }
    // Recurring expenses are a tab of Expenses, not a page of their own.
    expect(within(nav).queryByRole('link', { name: 'Recurring' })).not.toBeInTheDocument();
    // A country carries its currency, so there is no Currencies page.
    expect(within(nav).queryByRole('link', { name: 'Currencies' })).not.toBeInTheDocument();
  });

  it('puts Quotes in the Work group, between Projects and People', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const work = within(nav).getByRole('list', { name: 'Work' });
    expect(within(work).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Overview',
      'Clients',
      'Projects',
      'Quotes',
      'People',
    ]);
    expect(within(work).getByRole('link', { name: 'Quotes' })).toHaveAttribute('href', '/quotes');
  });

  it('shows who is signed in, with Change password and Sign out in a popover on the name', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const account = screen.getByRole('region', { name: 'Account' });
    await user.click(within(account).getByRole('button', { name: 'Ada Admin' }));
    const menu = await screen.findByRole('dialog', { name: 'Account options' });
    expect(within(menu).getByRole('button', { name: 'Change password' })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
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
    ['/quotes', 'Quotes'],
    ['/quotes/new', 'New quote'],
  ])('shows the real page at %s, with Quotes current in the sidebar', (route, title) => {
    renderAt(route);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Quotes' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText('Planned, not built yet')).not.toBeInTheDocument();
  });

  it('opens /quotes/3 on the editor with that quote, not on the new-quote form', async () => {
    coreApi.defaults.adapter = fakeAdapter((config) =>
      config.url === '/quotations/3'
        ? { status: 200, data: quoteEnvelope({ ...quoteRows[1], id: 3 }) }
        : { status: 200, data: envelope([]) },
    );
    renderAt('/quotes/3');
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard refresh' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to quotes' })).toHaveAttribute('href', '/quotes');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Quotes' })).toHaveAttribute('aria-current', 'page');
  });

  it('caps every page at the content width but lets the quote editor use the full width', async () => {
    const user = userEvent.setup();
    renderAt('/quotes');
    expect(await screen.findByRole('heading', { level: 1, name: 'Quotes' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveClass('max-w-[75rem]');

    await user.click(screen.getByRole('button', { name: 'New quote' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'New quote' })).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveClass('max-w-[75rem]');

    await user.click(screen.getByRole('link', { name: 'Back to quotes' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Quotes' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveClass('max-w-[75rem]');
  });

  it.each(['/quotes/3', '/quotes/abc'])('lets %s use the full width while it loads or is not found', async (route) => {
    // The quote never arrives, so /quotes/3 stays loading.
    coreApi.defaults.adapter = fakeAdapter((config) =>
      config.url === '/quotations/3' ? new Promise(() => undefined) : { status: 200, data: envelope([]) },
    );
    renderAt(route);
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveClass('max-w-[75rem]');
  });

  it.each(['/', '/projects', '/projects/1', '/finance/invoices', '/nope'])('keeps %s at the content width', (route) => {
    renderAt(route);
    expect(screen.getByRole('main')).toHaveClass('max-w-[75rem]');
  });

  it.each([
    ['/', 'Overview'],
    ['/clients', 'Clients'],
    ['/projects', 'Projects'],
    ['/people', 'People'],
    ['/finance/invoices', 'Invoices'],
    ['/finance/expenses', 'Expenses'],
    ['/categories', 'Categories'],
    ['/technologies', 'Technologies'],
    ['/countries', 'Countries'],
    ['/expense-types', 'Expense types'],
    ['/users', 'Users'],
  ])('shows the page title for %s', (route, title) => {
    renderAt(route);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });

  it('no longer has a Currencies page', () => {
    renderAt('/currencies');
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
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
