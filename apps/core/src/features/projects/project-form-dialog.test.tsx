import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
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
      key: null,
      billingAddress: null,
      discountPercent: 0,
      projectStatus: 'active',
      startDate: null,
      endDate: null,
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
      key: null,
      billingAddress: null,
      discountPercent: 0,
      projectStatus: 'active',
      startDate: null,
      endDate: null,
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
      key: 'WEB',
      billingAddress: 'Acme Corporation\n1 Anvil Road\nPune, India',      discountPercent: 0,
      projectStatus: 'active',
      startDate: '2026-01-01',
      endDate: null,
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
      key: null,
      billingAddress: null,
      discountPercent: 0,
      projectStatus: 'completed',
      startDate: '2025-03-01',
      endDate: '2025-09-30',
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

const failure = (status: number) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, {
    status,
    data: {},
    statusText: String(status),
    headers: {},
    config: {} as never,
  });

const REMOVED_ELSEWHERE =
  'This project was removed elsewhere, so it cannot be saved. Close this dialog and go back to Projects.';

describe('ProjectFormDialog: a project removed elsewhere', () => {
  async function submit(project?: ProjectRow) {
    const user = userEvent.setup();
    openDialog({ project });
    if (!project) {
      await user.type(screen.getByLabelText('Name'), 'Hooli');
      await user.selectOptions(screen.getByLabelText('Project type'), 'Product');
      await user.selectOptions(screen.getByLabelText('Billing type'), 'Retainer');
    }
    await user.click(screen.getByRole('button', { name: 'Save' }));
  }

  it('does not offer a retry that cannot work when the project is gone (404 on edit)', async () => {
    vi.mocked(coreApi.patch).mockRejectedValue(failure(404));
    await submit(website);
    expect(await screen.findByRole('alert')).toHaveTextContent(REMOVED_ELSEWHERE);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it.each([
    ['a 500 on edit', 'patch', website, 500],
    ['a 404 on add', 'post', undefined, 404],
  ] as const)('still offers a retry for %s', async (_label, method, project, status) => {
    vi.mocked(coreApi[method]).mockRejectedValue(failure(status));
    await submit(project);
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save. Try again.');
  });
});

describe('ProjectFormDialog: key and billing address', () => {
  it('shows the key in capitals as it is typed and sends it, with the address and its line breaks', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Name'), 'Hooli');
    await user.type(screen.getByLabelText('Key'), 'tko');
    expect(screen.getByLabelText('Key')).toHaveValue('TKO');
    await user.type(screen.getByLabelText('Billing address'), 'Michael Jordan,{enter}Venice');
    await user.selectOptions(screen.getByLabelText('Project type'), 'Product');
    await user.selectOptions(screen.getByLabelText('Billing type'), 'Retainer');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/projects', {
      name: 'Hooli',
      description: null,
      clientId: null,
      projectType: 'product',
      billingType: 'retainer',
      key: 'TKO',
      billingAddress: 'Michael Jordan,\nVenice',      discountPercent: 0,
      projectStatus: 'active',
      startDate: null,
      endDate: null,
    });
  });

  it('explains the key and the address', () => {
    openDialog();

    expect(screen.getByText('A short code used to number invoices, like TKO. Leave empty to type invoice numbers by hand.')).toBeInTheDocument();
    expect(screen.getByText('Printed under “Billed to” on the invoice.')).toBeInTheDocument();
  });

  it.each(['T', 'ABCDEFGHIJK', 'T-K', 'T K'])('refuses a key of %j and sends nothing', async (key) => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Name'), 'Hooli');
    await user.type(screen.getByLabelText('Key'), key);
    await user.selectOptions(screen.getByLabelText('Project type'), 'Product');
    await user.selectOptions(screen.getByLabelText('Billing type'), 'Retainer');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Use 2 to 10 letters or digits')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('says so on the key field, and stays open, when another project already uses it', async () => {
    const taken = new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, {
      status: 409,
      data: { statusCode: 409, message: 'Another project already uses the key "TKO"', data: null },
      statusText: '409',
      headers: {},
      config: {} as never,
    });
    vi.mocked(coreApi.post).mockRejectedValue(taken);
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Name'), 'Hooli');
    await user.type(screen.getByLabelText('Key'), 'TKO');
    await user.selectOptions(screen.getByLabelText('Project type'), 'Product');
    await user.selectOptions(screen.getByLabelText('Billing type'), 'Retainer');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Another project already uses that key.')).toBeInTheDocument();
    expect(screen.queryByText('That did not save. Try again.')).not.toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('opens on the key and address of the project and clears both with null', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ project: website });
    expect(screen.getByLabelText('Key')).toHaveValue('WEB');
    expect(screen.getByLabelText('Billing address')).toHaveValue('Acme Corporation\n1 Anvil Road\nPune, India');
    await user.clear(screen.getByLabelText('Key'));
    await user.clear(screen.getByLabelText('Billing address'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/projects/1', expect.objectContaining({ key: null, billingAddress: null }));
  });
});

describe('ProjectFormDialog: discount', () => {
  async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Name'), 'Hooli');
    await user.selectOptions(screen.getByLabelText('Project type'), 'Product');
    await user.selectOptions(screen.getByLabelText('Billing type'), 'Retainer');
  }

  it('starts at 0 and says what it does', () => {
    openDialog();

    expect(screen.getByLabelText('Discount (%)')).toHaveValue('0');
    expect(
      screen.getByText('Taken off every invoice of this project, up to 50. Each invoice can change it.'),
    ).toBeInTheDocument();
  });

  it.each([
    ['7.5', 7.5],
    ['12.25', 12.25],
    ['50', 50],
    ['', 0],
  ])('sends %j as the number %s', async (typed, sent) => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog();
    await fillRequired(user);
    await user.clear(screen.getByLabelText('Discount (%)'));
    if (typed !== '') await user.type(screen.getByLabelText('Discount (%)'), typed);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/projects', expect.objectContaining({ discountPercent: sent }));
  });

  it.each([
    ['50.01', 'Discount must be from 0 to 50'],
    ['75', 'Discount must be from 0 to 50'],
    ['abc', 'Enter a percentage like 7.5'],
    ['1.234', 'Enter a percentage like 7.5'],
    ['10%', 'Enter a percentage like 7.5'],
    ['-5', 'Enter a percentage like 7.5'],
  ])('refuses %j with “%s” and sends nothing', async (typed, message) => {
    const user = userEvent.setup();
    openDialog();
    await fillRequired(user);
    await user.clear(screen.getByLabelText('Discount (%)'));
    await user.type(screen.getByLabelText('Discount (%)'), typed);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText('Discount (%)')).toHaveAttribute('aria-invalid', 'true');
    expect(coreApi.post).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('opens on the project’s discount and saves it unchanged', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    const [discounted] = projectRowsSchema.parse([{ ...projectRows[0], discountPercent: 12.25 }]);
    openDialog({ project: discounted });
    expect(screen.getByLabelText('Discount (%)')).toHaveValue('12.25');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/projects/1', expect.objectContaining({ discountPercent: 12.25 }));
  });

  it('changes a project’s discount, and takes it back to none with 0', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    const [discounted] = projectRowsSchema.parse([{ ...projectRows[0], discountPercent: 10 }]);
    openDialog({ project: discounted });
    await user.clear(screen.getByLabelText('Discount (%)'));
    await user.type(screen.getByLabelText('Discount (%)'), '0');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/projects/1', expect.objectContaining({ discountPercent: 0 }));
  });
});
