import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { coreApi } from '@/lib/core-api';
import { AuthTestProvider } from '@/test/auth';
import { envelope, fakeAdapter } from '@/test/fake-adapter';
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

/** The page's own area, which a page can ask to be the whole height and width left beside the sidebar. */
const main = () => screen.getByRole('main');

describe('App shell: the main area', () => {
  it('is the usual centred column on every page', () => {
    for (const route of ['/', '/resources/people', '/resources/leave', '/projects']) {
      const { unmount } = renderAt(route);
      expect(main()).toHaveAttribute('data-layout', 'page');
      expect(main()).toHaveClass('max-w-[75rem]');
      unmount();
    }
  });

  it('is the whole area beside the sidebar, edge to edge and down to the bottom, on the allocation board', () => {
    renderAt('/resources/allocation');
    expect(main()).toHaveAttribute('data-layout', 'full');
    expect(main()).not.toHaveClass('max-w-[75rem]');
    expect(main()).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col');
  });

  it('is the usual column again on the allocation ledger', () => {
    renderAt('/resources/allocation?tab=ledger');
    expect(main()).toHaveAttribute('data-layout', 'page');
    expect(main()).toHaveClass('max-w-[75rem]');
  });

  it('follows the tab: full on the board, usual on the ledger, and full again back on the board', async () => {
    const user = userEvent.setup();
    renderAt('/resources/allocation');
    expect(main()).toHaveAttribute('data-layout', 'full');
    await user.click(screen.getByRole('tab', { name: 'Ledger' }));
    expect(main()).toHaveAttribute('data-layout', 'page');
    await user.click(screen.getByRole('tab', { name: 'Board' }));
    expect(main()).toHaveAttribute('data-layout', 'full');
  });

  it('goes back to the usual column when the board is left for another page', async () => {
    const user = userEvent.setup();
    renderAt('/resources/allocation');
    expect(main()).toHaveAttribute('data-layout', 'full');
    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'People' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'People' })).toBeInTheDocument();
    expect(main()).toHaveAttribute('data-layout', 'page');
  });

  it('keeps the shell as tall as the window, not taller, while the board is up, so only the board scrolls', () => {
    const { container } = renderAt('/resources/allocation');
    expect(container.firstElementChild).toHaveClass('h-dvh');
    expect(container.firstElementChild).not.toHaveClass('min-h-dvh');
    // The column beside the sidebar (the header, on a phone, and the main area) is that tall too, not as tall as its content.
    expect(main().parentElement).toHaveClass('h-full', 'min-h-0');
  });

  it('keeps the usual page at least as tall as the window, free to grow', () => {
    const { container } = renderAt('/resources/leave');
    expect(container.firstElementChild).toHaveClass('min-h-dvh');
    expect(container.firstElementChild).not.toHaveClass('h-dvh');
    expect(main().parentElement).not.toHaveClass('h-full');
  });
});

describe('App shell', () => {
  it('lists every page in five groups', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const label of ['Overview', 'Clients', 'Projects', 'People', 'Allocation', 'Leave', 'Invoices', 'Expenses', 'Categories', 'Technologies', 'Countries', 'Expense types', 'Users']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
    for (const group of ['Work', 'Resources', 'Finance', 'Reference data', 'Admin']) {
      expect(within(nav).getByText(group)).toBeInTheDocument();
    }
    // Recurring expenses are a tab of Expenses, not a page of their own.
    expect(within(nav).queryByRole('link', { name: 'Recurring' })).not.toBeInTheDocument();
    // A country carries its currency, so there is no Currencies page.
    expect(within(nav).queryByRole('link', { name: 'Currencies' })).not.toBeInTheDocument();
  });

  it('puts People, Allocation and Leave in the Resources group, not under Work', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const resources = within(within(nav).getByRole('list', { name: 'Resources' }));
    expect(resources.getAllByRole('link').map((link) => link.textContent)).toEqual(['People', 'Allocation', 'Leave']);
    expect(resources.getByRole('link', { name: 'People' })).toHaveAttribute('href', '/resources/people');
    expect(resources.getByRole('link', { name: 'Allocation' })).toHaveAttribute('href', '/resources/allocation');
    expect(resources.getByRole('link', { name: 'Leave' })).toHaveAttribute('href', '/resources/leave');
    const work = within(within(nav).getByRole('list', { name: 'Work' }));
    expect(work.queryByRole('link', { name: 'People' })).not.toBeInTheDocument();
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
    ['/', 'Overview'],
    ['/clients', 'Clients'],
    ['/projects', 'Projects'],
    ['/resources/people', 'People'],
    ['/resources/allocation', 'Allocation'],
    ['/resources/leave', 'Leave'],
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

  it('sends the old /people address to the People page in Resources', () => {
    renderAt('/people');
    expect(screen.getByRole('heading', { level: 1, name: 'People' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'People' })).toHaveAttribute('aria-current', 'page');
  });

  it('keeps Allocation current on its page, and not People', () => {
    renderAt('/resources/allocation');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Allocation' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'People' })).not.toHaveAttribute('aria-current');
  });

  it('keeps People current on a person’s page', () => {
    renderAt('/resources/people/1');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'People' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name: 'Person' })).toBeInTheDocument();
  });

  it('keeps Leave current on its page', () => {
    renderAt('/resources/leave');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Leave' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Allocation' })).not.toHaveAttribute('aria-current');
  });

  it('no longer has a Planned page for Allocation, which is built', () => {
    renderAt('/planned/allocation');
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
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
