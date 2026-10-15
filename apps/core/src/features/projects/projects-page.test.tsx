import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
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
    expect(mobile.getAllByRole('cell').slice(0, 6).map((cell) => cell.textContent)).toEqual([
      'Mobile app',
      '',
      'Product',
      'Fixed cost',
      '$32,000',
      '$0',
    ]);
  });

  it('shows a dash for the types of a project saved before they existed', async () => {
    renderWithProviders(<ProjectsPage />);
    const legacy = await rowOf('Legacy portal');
    expect(legacy.getAllByRole('cell').slice(0, 6).map((cell) => cell.textContent)).toEqual([
      'Legacy portal',
      'Acme',
      '—',
      '—',
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
