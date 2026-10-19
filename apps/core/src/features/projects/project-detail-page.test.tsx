import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { coreApi } from '@/lib/core-api';
import { queryDefaults } from '@/lib/query-client';
import { categoriesEnvelope } from '@/test/fixtures/categories';
import { clientRows, clientsEnvelope, contactsEnvelope } from '@/test/fixtures/clients';
import {
  draftEnvelope,
  emailDraftEnvelope,
  invoiceRows,
  invoicesEnvelope,
  nextNumberEnvelope,
  peopleEnvelope,
  projectEnvelope,
  projectRows,
  resourcesEnvelope,
} from '@/test/fixtures/projects';
import { renderWithProviders } from '@/test/utils';
import { ProjectDetailPage } from './project-detail-page';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

// A fixed "today", so Mark paid can be checked against an exact date.
vi.mock('@/lib/format', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/format')>()),
  localToday: () => '2026-11-20',
}));

const failure = (status: number) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, {
    status,
    data: {},
    statusText: String(status),
    headers: {},
    config: {} as never,
  });

/** What the service answers a write with; the page never reads it. */
const saved = { data: { statusCode: 200, message: 'saved', data: {}, meta: null } };

const serve = (
  opts: { project?: unknown; invoices?: unknown; resources?: unknown; clients?: unknown; contacts?: unknown } = {},
) =>
  vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
    if (path === '/projects/1') return { data: opts.project ?? projectEnvelope() };
    if (path === '/invoices') return { data: opts.invoices ?? invoicesEnvelope() };
    if (path === '/project-resources') return { data: opts.resources ?? resourcesEnvelope() };
    if (path === '/clients') {
      if (opts.clients === 'fail') throw new Error('down');
      return { data: opts.clients ?? clientsEnvelope() };
    }
    if (path === '/client-contacts') {
      if (opts.contacts === 'fail') throw new Error('down');
      return { data: opts.contacts ?? contactsEnvelope() };
    }
    if (path === '/people') return { data: peopleEnvelope() };
    if (path === '/categories') return { data: categoriesEnvelope() };
    if (path === '/projects/1/invoice-draft') return { data: draftEnvelope() };
    if (path === '/projects/1/next-invoice-number') return { data: nextNumberEnvelope() };
    if (path === '/invoices/1/pdf') return { data: new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }) };
    if (path === '/invoices/1/email-draft') return { data: emailDraftEnvelope() };
    throw new Error(`unexpected GET ${path}`);
  }) as never);

const INVOICES_TAB = '/projects/1?tab=invoices';
const RESOURCES_TAB = '/projects/1?tab=resources';

/** Shows the address's query string, so a test can see which tab the page put there. */
function Search() {
  return <code data-testid="search">{useLocation().search}</code>;
}

function renderAt(route: string) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/projects" element={<p>Projects list</p>} />
      </Routes>
      <Search />
    </>,
    { route },
  );
}

const sentence = (expected: string) => (_: string, element: Element | null) =>
  element?.tagName === 'P' && element.textContent === expected;

/** The value beside a label in the Overview facts. */
const fact = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement;

const gets = (path: string) => vi.mocked(coreApi.get).mock.calls.filter(([called]) => called === path);

beforeEach(() => {
  serve();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('ProjectDetailPage: reading', () => {
  it('asks for the project and only its own invoices', async () => {
    renderAt('/projects/1');
    await screen.findByRole('heading', { level: 1, name: 'Website' });
    expect(coreApi.get).toHaveBeenCalledWith('/projects/1');
    expect(coreApi.get).toHaveBeenCalledWith('/invoices', { params: { projectId: 1 } });
  });

  it('shows the project, its facts and the totals sentence', async () => {
    renderAt('/projects/1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Website' })).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Resource augmentation')).toBeInTheDocument();
    expect(screen.getByText('Retainer')).toBeInTheDocument();
    expect(screen.getByText('Marketing site.')).toBeInTheDocument();
    expect(screen.getByText('WEB')).toBeInTheDocument();
    expect(screen.getByText(/Acme Corporation/)).toBeInTheDocument();
    expect(screen.getByText(/1 Anvil Road/)).toBeInTheDocument();
    expect(await screen.findByText(sentence('$12,000.00 outstanding of $48,000.00 invoiced.'))).toBeInTheDocument();
  });

  it('shows dashes for a project with no client or types', async () => {
    const legacy = { ...projectRows[2], client: null };
    serve({ project: projectEnvelope(legacy), invoices: invoicesEnvelope([]), resources: resourcesEnvelope([]) });
    renderAt('/projects/1');
    await screen.findByRole('heading', { level: 1, name: 'Legacy portal' });
    for (const label of ['Client', 'Project type', 'Billing type', 'Key', 'Discount', 'Billing address']) {
      expect(fact(label)).toHaveTextContent('—');
    }
  });

  it('lists the invoices newest issue date first, each with its status', async () => {
    renderAt(INVOICES_TAB);
    const table = await screen.findByRole('table', { name: 'Invoices' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const newest = within(rows[0]);
    expect(newest.getByText('INV-002')).toBeInTheDocument();
    expect(newest.getByText('1 Nov 2026')).toBeInTheDocument();
    expect(newest.getByText('$12,000.00')).toBeInTheDocument();
    expect(newest.getByText('Unpaid')).toBeInTheDocument();
    const older = within(rows[1]);
    expect(older.getByText('INV-001')).toBeInTheDocument();
    expect(older.getByText('October retainer')).toBeInTheDocument();
    expect(older.getByText('1 Oct 2026')).toBeInTheDocument();
    expect(older.getByText('31 Oct 2026')).toBeInTheDocument();
    expect(older.getByText('$36,000.00')).toBeInTheDocument();
    expect(older.getByText('Paid 12 Oct 2026')).toBeInTheDocument();
  });

  describe('with no invoices', () => {
    beforeEach(() => {
      serve({
        project: projectEnvelope({ ...projectRows[0], totalValueCents: 0, totalOutstandingCents: 0 }),
        invoices: invoicesEnvelope([]),
      });
    });

    it('says on the overview that nothing is invoiced yet', async () => {
      renderAt('/projects/1');
      expect(await screen.findByText(sentence('Nothing is invoiced yet.'))).toBeInTheDocument();
    });

    it('says so on the invoices tab, and offers the first invoice', async () => {
      renderAt(INVOICES_TAB);
      expect(await screen.findByText('No invoices yet.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add the first invoice' })).toBeInTheDocument();
    });
  });

  it('links back to the projects', async () => {
    renderAt('/projects/1');
    expect(await screen.findByRole('link', { name: 'Back to projects' })).toHaveAttribute('href', '/projects');
  });
});

describe('ProjectDetailPage: resources', () => {
  it('asks for only this project’s resources and lists them on the resources tab', async () => {
    renderAt(RESOURCES_TAB);
    const table = await screen.findByRole('table', { name: 'Resources' });
    expect(coreApi.get).toHaveBeenCalledWith('/project-resources', { params: { projectId: 1 } });
    expect(within(table).getByText('Ben Cho')).toBeInTheDocument();
  });

  it('keeps the invoices usable when only the resources fail to load', async () => {
    vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
      if (path === '/projects/1') return { data: projectEnvelope() };
      if (path === '/invoices') return { data: invoicesEnvelope() };
      throw new Error('down');
    }) as never);
    const user = userEvent.setup();
    renderAt(INVOICES_TAB);
    expect(await screen.findByRole('table', { name: 'Invoices' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Resources' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
  });

  it('opens the resource dialog from the panel', async () => {
    const user = userEvent.setup();
    renderAt(RESOURCES_TAB);
    await user.click(await screen.findByRole('button', { name: 'Add resource' }));
    expect(screen.getByRole('dialog', { name: 'New resource' })).toBeInTheDocument();
  });
});

describe('ProjectDetailPage: tabs', () => {
  const tab = (name: string) => screen.getByRole('tab', { name });

  it('opens on the overview, and the other two tabs say how many they hold', async () => {
    // One invoice and two resources, so a count on the wrong tab shows.
    serve({ invoices: invoicesEnvelope([invoiceRows[0]]) });
    renderAt('/projects/1');
    expect(await screen.findByRole('tab', { name: 'Invoices 1' })).toHaveAttribute('aria-selected', 'false');
    expect(await screen.findByRole('tab', { name: 'Resources 2' })).toHaveAttribute('aria-selected', 'false');
    expect(tab('Overview')).toHaveAttribute('aria-selected', 'true');
  });

  it('shows no count while a tab’s list has not loaded', async () => {
    vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
      if (path === '/projects/1') return { data: projectEnvelope() };
      throw new Error('down');
    }) as never);
    renderAt('/projects/1');
    await screen.findByRole('heading', { level: 1, name: 'Website' });
    expect(tab('Invoices')).toBeInTheDocument();
    expect(tab('Resources')).toBeInTheDocument();
  });

  it('keeps the tables off the overview', async () => {
    renderAt('/projects/1');
    await screen.findByText(sentence('$12,000.00 outstanding of $48,000.00 invoiced.'));
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Invoices' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Resources' })).not.toBeInTheDocument();
  });

  it('switches to a tab on click, shows only that tab, and writes it into the address', async () => {
    const user = userEvent.setup();
    renderAt('/projects/1');
    await user.click(await screen.findByRole('tab', { name: 'Invoices 2' }));

    expect(await screen.findByRole('table', { name: 'Invoices' })).toBeInTheDocument();
    expect(screen.queryByText('Acme')).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Resources' })).not.toBeInTheDocument();
    expect(tab('Invoices 2')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('search')).toHaveTextContent('?tab=invoices');

    await user.click(tab('Resources 2'));
    expect(await screen.findByRole('table', { name: 'Resources' })).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Invoices' })).not.toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent('?tab=resources');
  });

  it('leaves the address bare when the person returns to the overview', async () => {
    const user = userEvent.setup();
    renderAt(INVOICES_TAB);
    await user.click(await screen.findByRole('tab', { name: 'Overview' }));
    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(screen.getByTestId('search')).toBeEmptyDOMElement();
  });

  it('replaces the address instead of adding to it, so Back leaves the page rather than stepping through tabs', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/projects', '/projects/1']} initialIndex={1}>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/projects" element={<p>Projects list</p>} />
          </Routes>
          <Back />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await user.click(await screen.findByRole('tab', { name: 'Invoices 2' }));
    await user.click(screen.getByRole('tab', { name: 'Resources 2' }));

    await user.click(screen.getByRole('button', { name: 'Go back' }));

    expect(await screen.findByText('Projects list')).toBeInTheDocument();
  });

  it.each([
    ['invoices', 'Invoices'],
    ['resources', 'Resources'],
  ])('opens on the %s tab when the address names it', async (value, table) => {
    renderAt(`/projects/1?tab=${value}`);
    expect(await screen.findByRole('table', { name: table })).toBeInTheDocument();
    expect(screen.queryByText('Acme')).not.toBeInTheDocument();
  });

  it('falls back to the overview for a tab it does not know', async () => {
    renderAt('/projects/1?tab=billing');
    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(tab('Overview')).toHaveAttribute('aria-selected', 'true');
  });

  it.each([
    ['the overview', '/projects/1'],
    ['the invoices tab', INVOICES_TAB],
    ['the resources tab', RESOURCES_TAB],
  ])('keeps Add invoice, Edit project and Delete project in the header on %s', async (_name, route) => {
    renderAt(route);
    expect(await screen.findByRole('button', { name: 'Add invoice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit project' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete project' })).toBeInTheDocument();
  });

  it('says how much of the outstanding amount is overdue', async () => {
    // Today is 20 Nov 2026 in this file; INV-002 fell due on the 15th.
    serve({ invoices: invoicesEnvelope([invoiceRows[0], { ...invoiceRows[1], dueDate: '2026-11-15' }]) });
    renderAt('/projects/1');
    expect(
      await screen.findByText(sentence('$12,000.00 outstanding of $48,000.00 invoiced, $12,000.00 of it overdue.')),
    ).toBeInTheDocument();
  });

  it('leaves overdue out while nothing is past due', async () => {
    serve({ invoices: invoicesEnvelope([invoiceRows[0], { ...invoiceRows[1], dueDate: '2026-11-30' }]) });
    renderAt('/projects/1');
    expect(await screen.findByText(sentence('$12,000.00 outstanding of $48,000.00 invoiced.'))).toBeInTheDocument();
  });
});

describe('ProjectDetailPage: when the project is not there', () => {
  it('shows a not-found state when the service answers 404', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(failure(404));
    renderAt('/projects/1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Project not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to projects' })).toHaveAttribute('href', '/projects');
  });

  it.each(['abc', '0', '-1', '007', '1.5', '99999999999', '2147483648'])(
    'shows the not-found state for /projects/%s without asking the service',
    async (id) => {
      renderAt(`/projects/${id}`);
      expect(await screen.findByRole('heading', { level: 1, name: 'Project not found' })).toBeInTheDocument();
      expect(coreApi.get).not.toHaveBeenCalled();
    },
  );

  it('shows an error with a retry for any other failure', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(failure(500));
    const user = userEvent.setup();
    renderAt('/projects/1');
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    serve();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Website' })).toBeInTheDocument();
  });

  it('keeps the project on screen when only its invoices fail to load', async () => {
    vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
      if (path === '/projects/1') return { data: projectEnvelope() };
      if (path === '/project-resources') return { data: resourcesEnvelope() };
      throw new Error('down');
    }) as never);
    const user = userEvent.setup();
    renderAt('/projects/1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Website' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Invoices' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
  });
});

describe('ProjectDetailPage: invoices', () => {
  it('marks an unpaid invoice paid with today’s local date, and refetches the totals', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderAt(INVOICES_TAB);
    await user.click(await screen.findByRole('button', { name: 'Mark paid INV-002' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalledWith('/invoices/2', { paidDate: '2026-11-20' }));
    await waitFor(() => expect(gets('/projects/1')).toHaveLength(2));
    expect(gets('/invoices')).toHaveLength(2);
  });

  it('marks a paid invoice unpaid by clearing its paid date', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderAt(INVOICES_TAB);
    await user.click(await screen.findByRole('button', { name: 'Mark unpaid INV-001' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalledWith('/invoices/1', { paidDate: null }));
  });

  it('sends one request however often Mark paid is clicked while it is saving', async () => {
    let release: () => void = () => undefined;
    vi.mocked(coreApi.patch).mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve(saved);
      }) as never,
    );
    const user = userEvent.setup();
    renderAt(INVOICES_TAB);
    const button = await screen.findByRole('button', { name: 'Mark paid INV-002' });
    await user.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    await user.click(button);
    expect(screen.getByRole('button', { name: 'Mark unpaid INV-001' })).toBeDisabled();
    release();
    await waitFor(() => expect(button).toBeEnabled());
    expect(coreApi.patch).toHaveBeenCalledTimes(1);
  });

  it('says so when marking paid fails', async () => {
    vi.mocked(coreApi.patch).mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    renderAt(INVOICES_TAB);
    await user.click(await screen.findByRole('button', { name: 'Mark paid INV-002' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save. Try again.');
  });

  it('opens the invoice dialog empty to add an invoice', async () => {
    const user = userEvent.setup();
    renderAt('/projects/1');
    await user.click(await screen.findByRole('button', { name: 'Add invoice' }));
    expect(screen.getByRole('dialog', { name: 'New invoice' })).toBeInTheDocument();
    expect(screen.getByLabelText('Number')).toHaveValue('');
    expect(await screen.findByLabelText('Line 1 description')).toHaveValue('Asha Rao — Mobile');
  });

  it('opens the invoice dialog on an invoice', async () => {
    const user = userEvent.setup();
    renderAt(INVOICES_TAB);
    await user.click(await screen.findByRole('button', { name: 'Edit INV-001' }));
    expect(screen.getByRole('dialog', { name: 'Edit invoice' })).toBeInTheDocument();
    expect(screen.getByLabelText('Number')).toHaveValue('INV-001');
  });

  it('adds an invoice under this project', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderAt('/projects/1');
    await user.click(await screen.findByRole('button', { name: 'Add invoice' }));
    await user.type(screen.getByLabelText('Number'), 'INV-003');
    await screen.findByLabelText('Line 1 description');
    await user.type(screen.getByLabelText('Issue date'), '2026-12-01');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith('/invoices', expect.objectContaining({ projectId: 1, number: 'INV-003' })),
    );
  });

  it('deletes an invoice only after the confirmation', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderAt(INVOICES_TAB);
    await user.click(await screen.findByRole('button', { name: 'Delete INV-001' }));
    expect(screen.getByText('Delete invoice “INV-001”?')).toBeInTheDocument();
    expect(coreApi.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete invoice' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/invoices/1'));
    await waitFor(() => expect(gets('/projects/1')).toHaveLength(2));
  });
});

describe('ProjectDetailPage: the project', () => {
  it('opens the project dialog on this project', async () => {
    const user = userEvent.setup();
    renderAt('/projects/1');
    await user.click(await screen.findByRole('button', { name: 'Edit project' }));
    expect(screen.getByRole('dialog', { name: 'Edit project' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Website');
  });

  it('deletes the project after the confirmation and returns to the list without asking for it again', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderAt('/projects/1');
    await user.click(await screen.findByRole('button', { name: 'Delete project' }));
    expect(screen.getByText('Delete project “Website”?')).toBeInTheDocument();
    expect(
      screen.getByText('Its resources and invoices are deleted with it. This cannot be undone.'),
    ).toBeInTheDocument();
    expect(coreApi.delete).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete project' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/projects/1'));
    expect(await screen.findByText('Projects list')).toBeInTheDocument();
    expect(gets('/projects/1')).toHaveLength(1);
  });
});

function Back() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Go back</button>;
}

describe('ProjectDetailPage: things removed elsewhere', () => {
  it('treats deleting an invoice that was already removed as done: the dialog closes and the table refetches', async () => {
    vi.mocked(coreApi.delete).mockRejectedValue(failure(404));
    const user = userEvent.setup();
    renderAt(INVOICES_TAB);
    await user.click(await screen.findByRole('button', { name: 'Delete INV-001' }));
    await user.click(screen.getByRole('button', { name: 'Delete invoice' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.queryByText('That did not work. Try again.')).not.toBeInTheDocument();
    await waitFor(() => expect(gets('/invoices')).toHaveLength(2));
  });

  it('treats deleting a project that was already removed as done: it returns to the list', async () => {
    vi.mocked(coreApi.delete).mockRejectedValue(failure(404));
    const user = userEvent.setup();
    renderAt('/projects/1');
    await user.click(await screen.findByRole('button', { name: 'Delete project' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete project' }));
    expect(await screen.findByText('Projects list')).toBeInTheDocument();
  });

  it('still says so when a delete fails for any other reason', async () => {
    vi.mocked(coreApi.delete).mockRejectedValue(failure(500));
    const user = userEvent.setup();
    renderAt(INVOICES_TAB);
    await user.click(await screen.findByRole('button', { name: 'Delete INV-001' }));
    await user.click(screen.getByRole('button', { name: 'Delete invoice' }));
    expect(await screen.findByText('That did not work. Try again.')).toBeInTheDocument();
  });

  it('moves focus to Add invoice after the first invoice replaces the empty state that held the opener', async () => {
    serve({
      project: projectEnvelope({ ...projectRows[0], totalValueCents: 0, totalOutstandingCents: 0 }),
      invoices: invoicesEnvelope([]),
    });
    vi.mocked(coreApi.post).mockImplementation((async () => {
      serve();
      return saved;
    }) as never);
    const user = userEvent.setup();
    renderAt(INVOICES_TAB);
    await user.click(await screen.findByRole('button', { name: 'Add the first invoice' }));
    await user.type(screen.getByLabelText('Number'), 'INV-003');
    await screen.findByLabelText('Line 1 description');
    await user.type(screen.getByLabelText('Issue date'), '2026-12-01');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add invoice' })).toHaveFocus());
  });

  it('moves focus to Add invoice after a delete removes the row that held the opener', async () => {
    vi.mocked(coreApi.delete).mockImplementation((async () => {
      serve({ invoices: invoicesEnvelope(invoiceRows.slice(1)) });
      return saved;
    }) as never);
    const user = userEvent.setup();
    renderAt(INVOICES_TAB);
    await user.click(await screen.findByRole('button', { name: 'Delete INV-001' }));
    await user.click(screen.getByRole('button', { name: 'Delete invoice' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add invoice' })).toHaveFocus());
  });

  it('does not show a deleted project from the cache when the person goes back to it', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    // The app's own cache settings: a fresh query is trusted for 30 seconds, which is how a deleted project lingers.
    const client = new QueryClient({
      defaultOptions: { queries: { ...queryDefaults.queries, retry: false }, mutations: queryDefaults.mutations },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/projects', '/projects/1']} initialIndex={1}>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/projects" element={<p>Projects list</p>} />
          </Routes>
          <Back />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await user.click(await screen.findByRole('button', { name: 'Delete project' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete project' }));
    expect(await screen.findByText('Projects list')).toBeInTheDocument();

    // From now on the service no longer has the project, and its invoices went with it.
    vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
      if (path === '/invoices') return { data: invoicesEnvelope([]) };
      throw failure(404);
    }) as never);
    await user.click(screen.getByRole('button', { name: 'Go back' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Project not found' })).toBeInTheDocument();
  });
});

describe('ProjectDetailPage: the invoice document', () => {
  beforeEach(() => {
    vi.mocked(URL.createObjectURL).mockReturnValue('blob:page-preview');
  });

  it('offers Preview, Download and Email on every invoice', async () => {
    renderAt(INVOICES_TAB);

    for (const number of ['INV-001', 'INV-002']) {
      for (const action of ['Preview', 'Download', 'Email']) {
        expect(await screen.findByRole('button', { name: `${action} ${number}` })).toBeInTheDocument();
      }
    }
  });

  it('previews the saved invoice in a dialog', async () => {
    const user = userEvent.setup();
    renderAt(INVOICES_TAB);

    await user.click(await screen.findByRole('button', { name: 'Preview INV-001' }));

    expect(screen.getByRole('dialog', { name: 'Preview INV-001' })).toBeInTheDocument();
    expect(await screen.findByTitle('Invoice INV-001')).toHaveAttribute('src', 'blob:page-preview');
    expect(coreApi.get).toHaveBeenCalledWith('/invoices/1/pdf', { responseType: 'blob' });
  });

  it('downloads the invoice as a file named for its number', async () => {
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    const user = userEvent.setup();
    renderAt(INVOICES_TAB);

    await user.click(await screen.findByRole('button', { name: 'Download INV-001' }));

    await waitFor(() => expect(names).toEqual(['INV-001.pdf']));
  });

  it('says so when a download fails, and clears the message on the next action', async () => {
    const user = userEvent.setup();
    renderAt(INVOICES_TAB);
    const download = await screen.findByRole('button', { name: 'Download INV-001' });
    const original = vi.mocked(coreApi.get).getMockImplementation();
    vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
      if (path === '/invoices/1/pdf') throw failure(500);
      return (original as (path: string) => Promise<unknown>)(path);
    }) as never);

    await user.click(download);
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not download. Try again.');

    await user.click(screen.getByRole('button', { name: 'Email INV-001' }));
    expect(screen.queryByText('That did not download. Try again.')).not.toBeInTheDocument();
  });

  it('opens the email dialog on the draft, and says who the invoice was sent to', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderAt(INVOICES_TAB);

    await user.click(await screen.findByRole('button', { name: 'Email INV-001' }));
    expect(screen.getByRole('dialog', { name: 'Email INV-001' })).toBeInTheDocument();
    expect(await screen.findByLabelText('To')).toHaveValue('michael@example.com');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(coreApi.post).toHaveBeenCalledWith('/invoices/1/send', expect.objectContaining({ to: ['michael@example.com'] }));
    expect(screen.getByRole('status')).toHaveTextContent('Invoice INV-001 sent to michael@example.com.');
  });
});

describe('ProjectDetailPage: the discount', () => {
  const discounted = (percent: number) => projectEnvelope({ ...projectRows[0], discountPercent: percent });

  it('shows the project’s discount among its facts, and a dash when there is none', async () => {
    serve({ project: discounted(7.5) });
    const { unmount } = renderAt('/projects/1');
    await screen.findByRole('heading', { level: 1, name: 'Website' });
    expect(screen.getByText('Discount').parentElement).toHaveTextContent('Discount7.5%');
    unmount();

    serve();
    renderAt('/projects/1');
    await screen.findByRole('heading', { level: 1, name: 'Website' });
    expect(screen.getByText('Discount').parentElement).toHaveTextContent('Discount—');
  });

  it('starts a new invoice from the project’s discount', async () => {
    serve({ project: discounted(10) });
    const user = userEvent.setup();
    renderAt('/projects/1');
    await user.click(await screen.findByRole('button', { name: 'Add invoice' }));

    expect(screen.getByLabelText('Discount (%)')).toHaveValue('10');
    // The draft's lines come to $36,000.00 before the discount.
    expect(await screen.findByText('Total $32,400.00')).toBeInTheDocument();
  });

  it('sends the project’s discount with the invoice it adds', async () => {
    serve({ project: discounted(10) });
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderAt('/projects/1');
    await user.click(await screen.findByRole('button', { name: 'Add invoice' }));
    await user.type(screen.getByLabelText('Number'), 'INV-003');
    await screen.findByLabelText('Line 1 description');
    await user.type(screen.getByLabelText('Issue date'), '2026-12-01');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith('/invoices', expect.objectContaining({ projectId: 1, discountPercent: 10 })),
    );
  });

  it('opens an invoice on its own discount, not the project’s', async () => {
    const own = invoicesEnvelope([
      { ...invoiceRows[0], subtotalCents: 3_600_000, discountPercent: 25, amountCents: 2_700_000 },
      invoiceRows[1],
    ]);
    serve({ project: discounted(10), invoices: own });
    const user = userEvent.setup();
    renderAt(INVOICES_TAB);
    await user.click(await screen.findByRole('button', { name: 'Edit INV-001' }));

    expect(screen.getByLabelText('Discount (%)')).toHaveValue('25');
    expect(screen.getByText('Total $27,000.00')).toBeInTheDocument();
  });

  it('lists each invoice at what the client pays, after its discount', async () => {
    const own = invoicesEnvelope([{ ...invoiceRows[0], subtotalCents: 3_600_000, discountPercent: 25, amountCents: 2_700_000 }]);
    serve({ invoices: own });
    renderAt(INVOICES_TAB);

    const row = (await screen.findByText('INV-001')).closest('tr') as HTMLElement;
    expect(within(row).getByText('$27,000.00')).toBeInTheDocument();
    expect(within(row).queryByText('$36,000.00')).not.toBeInTheDocument();
  });
});

describe('ProjectDetailPage: status and dates', () => {
  it('shows the status as a badge beside the title', async () => {
    renderAt('/projects/1');
    const title = await screen.findByRole('heading', { level: 1, name: 'Website' });
    expect(within(title.parentElement as HTMLElement).getByText('Active')).toBeInTheDocument();
  });

  it('shows Start and End among the facts, and a dash for an empty one', async () => {
    renderAt('/projects/1');
    await screen.findByRole('heading', { level: 1, name: 'Website' });
    expect(fact('Start')).toHaveTextContent('1 Jan 2026');
    expect(fact('End')).toHaveTextContent('—');
  });

  it('shows a completed project with both of its dates', async () => {
    serve({ project: projectEnvelope(projectRows[2]), invoices: invoicesEnvelope([]), resources: resourcesEnvelope([]) });
    renderAt('/projects/1');
    const title = await screen.findByRole('heading', { level: 1, name: 'Legacy portal' });
    expect(within(title.parentElement as HTMLElement).getByText('Completed')).toBeInTheDocument();
    expect(fact('Start')).toHaveTextContent('1 Mar 2025');
    // Some ICU versions spell September "Sept" in en-GB.
    expect(fact('End')).toHaveTextContent(/^30 Sept? 2025$/);
  });
});

describe('ProjectDetailPage: technologies', () => {
  it('lists the technologies in the order the service sends them', async () => {
    renderAt('/projects/1');
    await screen.findByRole('heading', { level: 1, name: 'Website' });
    expect(fact('Technologies')).toHaveTextContent('Nest, React');
  });

  it('shows a dash for a project that uses none', async () => {
    serve({ project: projectEnvelope(projectRows[1]), invoices: invoicesEnvelope([]), resources: resourcesEnvelope([]) });
    renderAt('/projects/1');
    await screen.findByRole('heading', { level: 1, name: 'Mobile app' });
    expect(fact('Technologies')).toHaveTextContent('—');
  });
});

describe('ProjectDetailPage: the client’s contact and location', () => {
  it('shows where the client is and who to talk to', async () => {
    renderAt('/projects/1');
    await screen.findByRole('heading', { level: 1, name: 'Website' });
    await waitFor(() => expect(fact('Location')).toHaveTextContent('Pune, India'));
    expect(fact('Contact')).toHaveTextContent('Ada Lovelace');
    expect(within(fact('Email')).getByRole('link', { name: 'ada@example.com' })).toHaveAttribute(
      'href',
      'mailto:ada@example.com',
    );
    expect(fact('Phone')).toHaveTextContent('+91 20 5550 0100');
  });

  it.each([
    ['a city and no country', { countryId: null, country: null }, 'Pune'],
    ['a country and no city', { city: null }, 'India'],
  ])('shows just the part of the location there is: %s', async (_name, change, expected) => {
    serve({ clients: clientsEnvelope([{ ...clientRows[0], ...change }]) });
    renderAt('/projects/1');
    await screen.findByRole('heading', { level: 1, name: 'Website' });
    await waitFor(() => expect(fact('Location')).toHaveTextContent(expected));
    expect(fact('Location')).not.toHaveTextContent(',');
  });

  it('shows dashes for a client with no city, country or contact', async () => {
    serve({ project: projectEnvelope({ ...projectRows[0], clientId: 2, client: clientRows[1] }) });
    renderAt('/projects/1');
    await screen.findByRole('heading', { level: 1, name: 'Website' });
    await waitFor(() => expect(fact('Location')).toHaveTextContent('—'));
    for (const label of ['Contact', 'Email', 'Phone']) expect(fact(label)).toHaveTextContent('—');
  });

  it('shows a dash, not an empty link, for a contact with no email', async () => {
    serve({ project: projectEnvelope({ ...projectRows[0], clientId: 3, client: clientRows[2] }) });
    renderAt('/projects/1');
    await screen.findByRole('heading', { level: 1, name: 'Website' });
    await waitFor(() => expect(fact('Contact')).toHaveTextContent('Grace Hopper'));
    expect(fact('Email')).toHaveTextContent('—');
    expect(within(fact('Email')).queryByRole('link')).not.toBeInTheDocument();
    expect(fact('Phone')).toHaveTextContent('+44 20 7946 0001');
  });

  it('shows dashes for a project with no client, at once, whatever the lists hold', async () => {
    serve({ project: projectEnvelope({ ...projectRows[0], clientId: null, client: null }) });
    renderAt('/projects/1');
    await screen.findByRole('heading', { level: 1, name: 'Website' });
    for (const label of ['Location', 'Contact', 'Email', 'Phone']) expect(fact(label)).toHaveTextContent('—');
  });

  it('shows dashes, not the old client’s contact, when the client was deleted since', async () => {
    serve({ project: projectEnvelope({ ...projectRows[0], clientId: 1, client: null }) });
    renderAt('/projects/1');
    await screen.findByRole('heading', { level: 1, name: 'Website' });
    await waitFor(() => expect(coreApi.get).toHaveBeenCalledWith('/client-contacts'));
    for (const label of ['Location', 'Contact', 'Email', 'Phone']) expect(fact(label)).toHaveTextContent('—');
  });

  it('says Unavailable for the contact when its list fails, and still shows the location', async () => {
    serve({ contacts: 'fail' });
    renderAt('/projects/1');
    await screen.findByRole('heading', { level: 1, name: 'Website' });
    await waitFor(() => expect(fact('Contact')).toHaveTextContent('Unavailable'));
    expect(fact('Email')).toHaveTextContent('Unavailable');
    expect(fact('Phone')).toHaveTextContent('Unavailable');
    await waitFor(() => expect(fact('Location')).toHaveTextContent('Pune, India'));
  });

  it('says Unavailable for the location when the clients list fails, and still shows the contact', async () => {
    serve({ clients: 'fail' });
    renderAt('/projects/1');
    await screen.findByRole('heading', { level: 1, name: 'Website' });
    await waitFor(() => expect(fact('Location')).toHaveTextContent('Unavailable'));
    await waitFor(() => expect(fact('Contact')).toHaveTextContent('Ada Lovelace'));
  });
});
