import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { coreApi } from '@/lib/core-api';
import { categoriesEnvelope } from '@/test/fixtures/categories';
import { peopleEnvelope, resourceRows, resourcesEnvelope } from '@/test/fixtures/projects';
import { renderWithProviders } from '@/test/utils';
import { ResourcesPanel } from './resources-panel';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const failure = (status: number) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, {
    status,
    data: {},
    statusText: String(status),
    headers: {},
    config: {} as never,
  });

const saved = { data: { statusCode: 200, message: 'saved', data: {}, meta: null } };

const serve = (resources: unknown = resourcesEnvelope()) =>
  vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
    if (path === '/project-resources') return { data: resources };
    if (path === '/people') return { data: peopleEnvelope() };
    if (path === '/categories') return { data: categoriesEnvelope() };
    throw new Error(`unexpected GET ${path}`);
  }) as never);

const renderPanel = (billingType: 'retainer' | 'fixed_cost' | null = 'retainer') =>
  renderWithProviders(<ResourcesPanel projectId={1} billingType={billingType} />);

beforeEach(() => {
  serve();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('ResourcesPanel: reading', () => {
  it('asks for only this project’s resources', async () => {
    renderPanel();
    await screen.findByRole('table', { name: 'Resources' });
    expect(coreApi.get).toHaveBeenCalledWith('/project-resources', { params: { projectId: 1 } });
  });

  it('lists each resource with its category, person and hourly rate, and a dash for what is missing', async () => {
    renderPanel();
    const table = await screen.findByRole('table', { name: 'Resources' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const asha = within(rows[0]);
    expect(asha.getByText('Asha Rao', { selector: 'td:nth-child(1)' })).toBeInTheDocument();
    expect(asha.getByText('Mobile')).toBeInTheDocument();
    expect(asha.getByText('Asha Rao', { selector: 'td:nth-child(3)' })).toBeInTheDocument();
    expect(asha.getByText('$150')).toBeInTheDocument();
    const ben = within(rows[1]);
    expect(ben.getByText('Web')).toBeInTheDocument();
    expect(ben.getByText('—')).toBeInTheDocument();
    expect(ben.getByText('$75')).toBeInTheDocument();
  });

  it('shows a dash for a category the service no longer lists', async () => {
    serve(resourcesEnvelope([{ ...resourceRows[0], category: null }]));
    renderPanel();
    const table = await screen.findByRole('table', { name: 'Resources' });
    expect(within(table).getByText('—')).toBeInTheDocument();
  });

  it('says so, and offers the first resource, when there are none; a retainer adds what resources are for', async () => {
    serve(resourcesEnvelope([]));
    renderPanel('retainer');
    expect(await screen.findByText('No resources yet.')).toBeInTheDocument();
    expect(screen.getByText('Resources build the lines of a retainer invoice.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add the first resource' })).toBeInTheDocument();
  });

  it('leaves out the retainer sentence for a fixed cost project', async () => {
    serve(resourcesEnvelope([]));
    renderPanel('fixed_cost');
    expect(await screen.findByText('No resources yet.')).toBeInTheDocument();
    expect(screen.queryByText('Resources build the lines of a retainer invoice.')).not.toBeInTheDocument();
  });

  it('shows an error with a retry inside the panel when the resources cannot be loaded', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(failure(500));
    const user = userEvent.setup();
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    serve();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table', { name: 'Resources' })).toBeInTheDocument();
  });
});

describe('ResourcesPanel: changing', () => {
  it('opens the resource dialog empty to add one', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Add resource' }));
    expect(screen.getByRole('dialog', { name: 'New resource' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('opens the resource dialog on a resource', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Edit Ben Cho' }));
    expect(screen.getByRole('dialog', { name: 'Edit resource' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Ben Cho');
  });

  it('deletes a resource only after the confirmation, then refetches the list', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Delete Asha Rao' }));
    expect(screen.getByText('Delete resource “Asha Rao”?')).toBeInTheDocument();
    expect(screen.getByText('Invoices already built from it keep their lines. This cannot be undone.')).toBeInTheDocument();
    expect(coreApi.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete resource' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/project-resources/1'));
    await waitFor(() =>
      expect(vi.mocked(coreApi.get).mock.calls.filter(([path]) => path === '/project-resources')).toHaveLength(2),
    );
  });

  it('treats deleting a resource that was already removed as done', async () => {
    vi.mocked(coreApi.delete).mockRejectedValue(failure(404));
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Delete Asha Rao' }));
    await user.click(screen.getByRole('button', { name: 'Delete resource' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });
});
