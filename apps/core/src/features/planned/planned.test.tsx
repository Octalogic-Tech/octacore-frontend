import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '@/app/app';
import type { AuthContextValue } from '@/features/auth/auth-context';
import { AuthTestProvider } from '@/test/auth';
import { adminUser } from '@/test/fixtures/users';
import { PLANNED } from './registry';

function renderAt(route: string, auth?: Partial<AuthContextValue>) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthTestProvider value={auth}>
        <MemoryRouter initialEntries={[route]}>
          <App />
        </MemoryRouter>
      </AuthTestProvider>
    </QueryClientProvider>,
  );
}

/** The suggested build order, written out here on purpose: moving a piece is a decision, not an accident. */
const IN_ORDER = [
  ['currency-tax', 'Currency and tax'],
  ['milestones', 'Milestone schedule'],
  ['recurring-invoices', 'Recurring retainer drafts'],
  ['skills', 'Skills matrix'],
  ['cash-flow', 'Cash-flow forecast'],
  ['profit-loss', 'Profit and loss'],
  ['quotes', 'Quote generator'],
  ['portfolio', 'Portfolio'],
] as const;

const DIALOGS = [
  ['recurring-invoices', 'Preview the schedule dialog', 'Schedule a retainer project'],
  ['milestones', 'Preview the milestone dialog', 'Milestone'],
  ['currency-tax', 'Preview the tax rate dialog', 'Tax rate'],
  ['profit-loss', 'Preview the expense dialog', 'Add an expense'],
  ['skills', 'Preview the skills dialog', 'Edit skills'],
  ['quotes', 'Preview the quote dialog', 'New quote'],
  ['portfolio', 'Preview the case study dialog', 'Case study'],
  ['portfolio', 'Preview the portfolio link dialog', 'New portfolio link'],
] as const;

describe('the planned registry', () => {
  it('lists the eight pieces in the suggested build order', () => {
    expect(PLANNED.map((spec) => [spec.id, spec.title])).toEqual(IN_ORDER);
  });

  it('has something to say in every section of every piece', () => {
    for (const spec of PLANNED) {
      expect(spec.summary, spec.id).not.toBe('');
      expect(spec.home, spec.id).not.toBe('');
      expect(spec.does.length, `${spec.id} does`).toBeGreaterThan(0);
      expect(spec.buildsOn.length, `${spec.id} buildsOn`).toBeGreaterThan(0);
      expect(spec.decisions.length, `${spec.id} decisions`).toBeGreaterThan(0);
      for (const dialog of spec.dialogs) {
        expect(dialog.fields.length, `${dialog.title} fields`).toBeGreaterThan(0);
        expect(dialog.happens.length, `${dialog.title} happens`).toBeGreaterThan(0);
      }
    }
  });

  it('never asks for a piece that comes later in the order', () => {
    const ids = PLANNED.map((spec) => spec.id);
    for (const spec of PLANNED) {
      for (const needed of spec.needs) {
        expect(ids.indexOf(needed), `${spec.id} needs ${needed}`).toBeGreaterThanOrEqual(0);
        expect(ids.indexOf(needed), `${spec.id} needs ${needed}`).toBeLessThan(ids.indexOf(spec.id));
      }
    }
  });
});

describe('the Planned index', () => {
  it('lists every piece in the suggested build order', () => {
    renderAt('/planned');
    expect(screen.getByRole('heading', { level: 1, name: 'Planned' })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Suggested build order' });
    const titles = within(list)
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(titles).toEqual(IN_ORDER.map(([, title]) => title));
  });

  it.each(IN_ORDER)('links %s to its own page', (id, title) => {
    renderAt('/planned');
    expect(screen.getByRole('link', { name: title })).toHaveAttribute('href', `/planned/${id}`);
  });

  it('says what a piece waits on', () => {
    renderAt('/planned');
    const card = screen.getByRole('listitem', { name: 'Cash-flow forecast' });
    expect(within(card).getByText(/Build after/)).toHaveTextContent('Build after: Currency and tax, Milestone schedule');
  });
});

describe('a planned page', () => {
  it.each(IN_ORDER)('%s says it is not built, and what it will be', (id, title) => {
    renderAt(`/planned/${id}`);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText('Planned, not built yet')).toBeInTheDocument();
    for (const section of ['What it will do', 'Builds on', 'Open decisions']) {
      expect(screen.getByRole('heading', { level: 2, name: section })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'All planned work' })).toHaveAttribute('href', '/planned');
  });

  it('has no dialog to preview when none is planned', () => {
    renderAt('/planned/cash-flow');
    expect(screen.queryByRole('button', { name: /Preview/ })).toBeNull();
  });

  it.each(DIALOGS)('%s opens the %s, which lists its fields and closes', async (id, button, title) => {
    const user = userEvent.setup();
    renderAt(`/planned/${id}`);
    await user.click(screen.getByRole('button', { name: button }));
    const dialog = await screen.findByRole('dialog', { name: title });
    expect(within(dialog).getByText('Preview only, not a working form')).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Fields' })).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'What happens' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Planned in the sidebar', () => {
  it('shows an admin one Planned link', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByText('Planned')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Planned features' })).toHaveAttribute('href', '/planned');
  });

  it('keeps Planned features current on a planned page', () => {
    renderAt('/planned/cash-flow');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Planned features' })).toHaveAttribute('aria-current', 'page');
  });

  it('hides the link and the pages from anyone who is not an admin', () => {
    renderAt('/planned', { user: { ...adminUser, role: 'viewer' } });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).queryByRole('link', { name: 'Planned features' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
  });
});
