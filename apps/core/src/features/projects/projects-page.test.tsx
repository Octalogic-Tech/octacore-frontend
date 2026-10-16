import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { coreApi } from '@/lib/core-api';
import { clientsEnvelope } from '@/test/fixtures/clients';
import { projectRows, projectsEnvelope } from '@/test/fixtures/projects';
import { renderWithProviders } from '@/test/utils';
import { ProjectsPage } from './projects-page';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

/** The next GET answers with this body, in the service's envelope. */
const serve = (projects: unknown = projectsEnvelope()) =>
  vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
    if (path === '/projects') return { data: projects };
    if (path === '/clients') return { data: clientsEnvelope() };
    throw new Error(`unexpected GET ${path}`);
  }) as never);

const rowOf = async (name: string) => within((await screen.findByRole('link', { name })).closest('tr') as HTMLElement);

beforeEach(() => {
  serve();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('ProjectsPage', () => {
  it('asks the core service for the projects, not the mock API', async () => {
    renderWithProviders(<ProjectsPage />);
    await screen.findByText('Website');
    expect(coreApi.get).toHaveBeenCalledWith('/projects');
  });

  it('lists each project with its client, type, billing and totals as currency', async () => {
    renderWithProviders(<ProjectsPage />);
    const website = await rowOf('Website');
    expect(website.getByText('Acme')).toBeInTheDocument();
    expect(website.getByText('Resource augmentation')).toBeInTheDocument();
    expect(website.getByText('Retainer')).toBeInTheDocument();
    expect(website.getByText('$48,000')).toBeInTheDocument();
    expect(website.getByText('$12,000')).toBeInTheDocument();
    expect(screen.getByText('1–3 of 3')).toBeInTheDocument();
  });

  it('keeps a project that has no client or description', async () => {
    renderWithProviders(<ProjectsPage />);
    const mobile = await rowOf('Mobile app');
    expect(mobile.getAllByRole('cell').slice(0, 7).map((cell) => cell.textContent)).toEqual([
      'Mobile app',
      '',
      'Product',
      'Fixed cost',
      'On hold',
      '$32,000',
      '$0',
    ]);
  });

  it('shows a dash for the types of a project saved before they existed', async () => {
    renderWithProviders(<ProjectsPage />);
    const legacy = await rowOf('Legacy portal');
    expect(legacy.getAllByRole('cell').slice(0, 7).map((cell) => cell.textContent)).toEqual([
      'Legacy portal',
      'Acme',
      '—',
      '—',
      'Completed',
      '$0',
      '$0',
    ]);
  });

  it('links each project name to its page', async () => {
    renderWithProviders(<ProjectsPage />);
    expect(await screen.findByRole('link', { name: 'Website' })).toHaveAttribute('href', '/projects/1');
    expect(screen.getByRole('link', { name: 'Legacy portal' })).toHaveAttribute('href', '/projects/3');
  });

  it.each<[string, string, string[]]>([
    ['a name', 'mobile', ['Mobile app']],
    ['a description', 'before types', ['Legacy portal']],
    ['a client', 'acme', ['Website', 'Legacy portal']],
    ['a project type', 'resource', ['Website']],
    ['a billing type', 'fixed', ['Mobile app']],
  ])('searches %s', async (_label, query, expected) => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectsPage />);
    await screen.findByText('Website');
    await user.type(screen.getByLabelText('Search projects'), query);
    for (const name of ['Website', 'Mobile app', 'Legacy portal']) {
      if (expected.includes(name)) expect(screen.getByText(name)).toBeInTheDocument();
      else expect(screen.queryByText(name)).not.toBeInTheDocument();
    }
  });

  it('says so when nothing matches the search', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectsPage />);
    await screen.findByText('Website');
    await user.type(screen.getByLabelText('Search projects'), 'zzz');
    expect(screen.getByText('No projects match “zzz”.')).toBeInTheDocument();
  });

  it('says so when there are no projects', async () => {
    serve(projectsEnvelope([]));
    renderWithProviders(<ProjectsPage />);
    expect(await screen.findByText('No projects yet.')).toBeInTheDocument();
  });

  it('shows an error with a retry when the service is down', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    renderWithProviders(<ProjectsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    serve();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Website')).toBeInTheDocument();
  });

  it('shows the error state for a bare array, which is what the mock sent', async () => {
    serve(projectRows);
    renderWithProviders(<ProjectsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
  });

  it('shows the error state for a row that lacks a field the page needs', async () => {
    serve(projectsEnvelope([{ ...projectRows[0], totalValue: undefined }]));
    renderWithProviders(<ProjectsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
  });
});

/** What the service answers a delete with; the page does not read it. */
const saved = { data: { statusCode: 200, message: 'saved', data: projectRows[0], meta: null } };

describe('ProjectsPage: writing', () => {
  it('offers to add the first project when there are none', async () => {
    serve(projectsEnvelope([]));
    renderWithProviders(<ProjectsPage />);
    expect(await screen.findByText('No projects yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add the first project' })).toBeInTheDocument();
  });

  it('opens the dialog empty to add a project', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectsPage />);
    await user.click(await screen.findByRole('button', { name: 'Add project' }));
    expect(screen.getByRole('dialog', { name: 'New project' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('opens the dialog on a project', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectsPage />);
    await user.click(await screen.findByRole('button', { name: 'Edit Website' }));
    expect(screen.getByRole('dialog', { name: 'Edit project' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Website');
  });

  it('deletes only after the confirmation, and says the resources and invoices go with it', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<ProjectsPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete Website' }));
    expect(screen.getByText('Delete project “Website”?')).toBeInTheDocument();
    expect(
      screen.getByText('Its resources and invoices are deleted with it. This cannot be undone.'),
    ).toBeInTheDocument();
    expect(coreApi.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/projects/1'));
    expect(coreApi.delete).toHaveBeenCalledTimes(1);
  });

  it('refetches the list after a delete', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<ProjectsPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete Website' }));
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    await waitFor(() =>
      expect(vi.mocked(coreApi.get).mock.calls.filter(([path]) => path === '/projects')).toHaveLength(2),
    );
  });
});

describe('ProjectsPage: a project removed elsewhere', () => {
  it('treats deleting a project that was already removed as done: the dialog closes and the list refetches', async () => {
    vi.mocked(coreApi.delete).mockRejectedValue(
      new AxiosError('gone', 'ERR_BAD_REQUEST', undefined, null, {
        status: 404,
        data: {},
        statusText: '404',
        headers: {},
        config: {} as never,
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProjectsPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete Website' }));
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.queryByText('That did not work. Try again.')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(vi.mocked(coreApi.get).mock.calls.filter(([path]) => path === '/projects')).toHaveLength(2),
    );
  });
});

describe('ProjectsPage: status', () => {
  const names = () => screen.getAllByRole('link').map((link) => link.textContent);

  it('shows each project’s status in its own column', async () => {
    renderWithProviders(<ProjectsPage />);
    expect(await screen.findByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect((await rowOf('Website')).getByText('Active')).toBeInTheDocument();
  });

  it('opens on All statuses and narrows to one status at a time', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectsPage />);
    await screen.findByText('Website');
    const filter = screen.getByLabelText('Status');
    expect(filter).toHaveValue('all');
    expect(names()).toEqual(['Website', 'Mobile app', 'Legacy portal']);

    await user.selectOptions(filter, 'Completed');
    expect(names()).toEqual(['Legacy portal']);
    await user.selectOptions(filter, 'On hold');
    expect(names()).toEqual(['Mobile app']);
    await user.selectOptions(filter, 'All statuses');
    expect(names()).toEqual(['Website', 'Mobile app', 'Legacy portal']);
  });

  it('says so when no project has the chosen status', async () => {
    const onlyActive = projectRows.map((row) => ({ ...row, projectStatus: 'active' }));
    serve(projectsEnvelope(onlyActive));
    const user = userEvent.setup();
    renderWithProviders(<ProjectsPage />);
    await screen.findByText('Website');
    await user.selectOptions(screen.getByLabelText('Status'), 'Completed');
    expect(screen.getByText('No projects have this status.')).toBeInTheDocument();
  });

  it('uses the search wording when text is typed too, and returns to page 1 when the filter changes', async () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      ...projectRows[0],
      id: 100 + index,
      name: `Project ${String(index + 1).padStart(2, '0')}`,
      key: null,
      projectStatus: index % 2 === 0 ? 'active' : 'completed',
    }));
    serve(projectsEnvelope(many));
    const user = userEvent.setup();
    renderWithProviders(<ProjectsPage />);
    await screen.findByText('Project 01');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('11–12 of 12')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Status'), 'Completed');
    expect(screen.getByText('1–6 of 6')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search projects'), 'nothing like this');
    expect(screen.getByText('No projects match “nothing like this”.')).toBeInTheDocument();
    expect(screen.queryByText('No projects have this status.')).not.toBeInTheDocument();
  });
});
