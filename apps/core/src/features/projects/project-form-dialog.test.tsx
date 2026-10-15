import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import { clientsEnvelope } from '@/test/fixtures/clients';
import { projectRows } from '@/test/fixtures/projects';
import { renderWithProviders } from '@/test/utils';
import { ProjectFormDialog } from './project-form-dialog';
import { projectRowsSchema, type ProjectRow } from './schema';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const [website, , legacy] = projectRowsSchema.parse(projectRows);

const onOpenChange = vi.fn();

/** What the service answers a save with; the dialog never reads it. */
const saved = { data: { statusCode: 200, message: 'saved', data: {}, meta: null } };

function openDialog(props: { project?: ProjectRow } = {}) {
  return renderWithProviders(<ProjectFormDialog open onOpenChange={onOpenChange} {...props} />);
}

beforeEach(() => {
  vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
    if (path === '/clients') return { data: clientsEnvelope() };
    throw new Error(`unexpected GET ${path}`);
  }) as never);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('ProjectFormDialog: adding', () => {
  it('creates the project with the body the service expects', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog();
    expect(screen.getByRole('dialog', { name: 'New project' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), 'Hooli');
    await user.type(screen.getByLabelText('Description'), 'Search and more.');
    await screen.findByRole('option', { name: 'Acme' });
    await user.selectOptions(screen.getByLabelText('Client'), 'Acme');
    await user.selectOptions(screen.getByLabelText('Project type'), 'Product');
    await user.selectOptions(screen.getByLabelText('Billing type'), 'Retainer');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledTimes(1);
    expect(coreApi.post).toHaveBeenCalledWith('/projects', {
      name: 'Hooli',
      description: 'Search and more.',
      clientId: 1,
      projectType: 'product',
      billingType: 'retainer',
    });
  });

  it('sends nulls for what is left empty', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Name'), 'Hooli');
    await user.selectOptions(screen.getByLabelText('Project type'), 'Resource augmentation');
    await user.selectOptions(screen.getByLabelText('Billing type'), 'Fixed cost');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/projects', {
      name: 'Hooli',
      description: null,
      clientId: null,
      projectType: 'resource_augmentation',
      billingType: 'fixed_cost',
    });
  });

  it('asks for a name and both types, and sends nothing', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Choose a project type')).toBeInTheDocument();
    expect(screen.getByText('Choose a billing type')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('says so, and stays open, when the save fails', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Name'), 'Hooli');
    await user.selectOptions(screen.getByLabelText('Project type'), 'Product');
    await user.selectOptions(screen.getByLabelText('Billing type'), 'Retainer');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save. Try again.');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe('ProjectFormDialog: editing', () => {
  it('opens on the project and sends PATCH with null for a cleared field', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ project: website });
    expect(screen.getByRole('dialog', { name: 'Edit project' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Website');
    expect(screen.getByLabelText('Project type')).toHaveValue('resource_augmentation');
    expect(screen.getByLabelText('Billing type')).toHaveValue('retainer');
    await screen.findByRole('option', { name: 'Acme' });
    expect(screen.getByLabelText('Client')).toHaveValue('1');
    await user.clear(screen.getByLabelText('Description'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).not.toHaveBeenCalled();
    expect(coreApi.patch).toHaveBeenCalledWith('/projects/1', {
      name: 'Website',
      description: null,
      clientId: 1,
      projectType: 'resource_augmentation',
      billingType: 'retainer',
    });
  });

  it('opens a legacy project on "Choose" and will not save until both types are picked', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ project: legacy });
    expect(screen.getByLabelText('Project type')).toHaveValue('');
    expect(screen.getByLabelText('Billing type')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Choose a project type')).toBeInTheDocument();
    expect(coreApi.patch).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByLabelText('Project type'), 'Product');
    await user.selectOptions(screen.getByLabelText('Billing type'), 'Fixed cost');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/projects/3', {
      name: 'Legacy portal',
      description: 'Built before types.',
      clientId: 1,
      projectType: 'product',
      billingType: 'fixed_cost',
    });
  });

  it('opens on None for a client the service no longer embeds, and saves it as null', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    const [orphan] = projectRowsSchema.parse([{ ...projectRows[0], client: null }]);
    openDialog({ project: orphan });
    await screen.findByRole('option', { name: 'Acme' });
    expect(screen.getByLabelText('Client')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/projects/1', expect.objectContaining({ clientId: null }));
  });

  it("keeps the project's own client as an option while the client list fails", async () => {
    vi.mocked(coreApi.get).mockRejectedValue(new Error('down'));
    openDialog({ project: website });
    expect(await screen.findByText('Clients could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Acme' })).toBeInTheDocument();
    expect(screen.getByLabelText('Client')).toHaveValue('1');
  });
});
