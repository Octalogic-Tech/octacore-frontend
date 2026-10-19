import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { coreApi } from '@/lib/core-api';
import { categoriesEnvelope } from '@/test/fixtures/categories';
import { peopleEnvelope, resourceRows } from '@/test/fixtures/projects';
import { renderWithProviders } from '@/test/utils';
import { ResourceFormDialog } from './resource-form-dialog';
import { resourceRowsSchema, type ResourceRow } from './schema';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const [asha] = resourceRowsSchema.parse(resourceRows);

const onOpenChange = vi.fn();

/** What the service answers a save with; the dialog never reads it. */
const saved = { data: { statusCode: 200, message: 'saved', data: {}, meta: null } };

const failure = (status: number) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, {
    status,
    data: {},
    statusText: String(status),
    headers: {},
    config: {} as never,
  });

const CHANGED_ELSEWHERE = 'This changed elsewhere, so it cannot be saved. Close this dialog and go back to Projects.';

const serve = (opts: { people?: 'fail' } = {}) =>
  vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
    if (path === '/people') {
      if (opts.people === 'fail') throw new Error('down');
      return { data: peopleEnvelope() };
    }
    if (path === '/categories') return { data: categoriesEnvelope() };
    throw new Error(`unexpected GET ${path}`);
  }) as never);

function openDialog(props: { resource?: ResourceRow } = {}) {
  return renderWithProviders(<ResourceFormDialog open onOpenChange={onOpenChange} projectId={1} {...props} />);
}

beforeEach(() => {
  serve();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('ResourceFormDialog: adding', () => {
  it('creates the resource under the project with the body the service expects', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog();
    expect(screen.getByRole('dialog', { name: 'New resource' })).toBeInTheDocument();
    await screen.findByRole('option', { name: 'Mobile' });
    await user.type(screen.getByLabelText('Name'), 'Zoë Müller');
    await user.selectOptions(screen.getByLabelText('Category'), 'Mobile');
    expect(screen.getByText('Dollars and cents, like 85.50.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Rate per hour'), '85.50');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledTimes(1);
    expect(coreApi.post).toHaveBeenCalledWith('/project-resources', {
      projectId: 1,
      name: 'Zoë Müller',
      personId: null,
      categoryId: 2,
      headcount: 1,
      rateCents: 8550,
    });
  });

  it('sends the chosen person as a number', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog();
    await screen.findByRole('option', { name: 'Ben Cho' });
    await user.selectOptions(screen.getByLabelText('Person'), 'Ben Cho');
    await user.selectOptions(screen.getByLabelText('Category'), 'Web');
    await user.type(screen.getByLabelText('Rate per hour'), '75');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/project-resources', {
      projectId: 1,
      name: 'Ben Cho',
      personId: 2,
      categoryId: 1,
      headcount: 1,
      rateCents: 7500,
    });
  });

  it('fills an empty name from the person it picks, and leaves a name already typed alone', async () => {
    const user = userEvent.setup();
    openDialog();
    await screen.findByRole('option', { name: 'Asha Rao' });
    await user.selectOptions(screen.getByLabelText('Person'), 'Asha Rao');
    expect(screen.getByLabelText('Name')).toHaveValue('Asha Rao');

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Open backend role');
    await user.selectOptions(screen.getByLabelText('Person'), 'Ben Cho');
    expect(screen.getByLabelText('Name')).toHaveValue('Open backend role');
  });

  it('asks for a name, a category and a rate, and sends nothing', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Choose a category')).toBeInTheDocument();
    expect(screen.getByText('Rate is required')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it.each(['12.505', '$85', '1,200'])('says what is wrong with a rate of %s and sends nothing', async (rate) => {
    const user = userEvent.setup();
    openDialog();
    await screen.findByRole('option', { name: 'Mobile' });
    await user.type(screen.getByLabelText('Name'), 'Zoë');
    await user.selectOptions(screen.getByLabelText('Category'), 'Mobile');
    await user.type(screen.getByLabelText('Rate per hour'), rate);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter an amount like 7.20, with no commas or signs')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('refuses a rate past the cap the service holds', async () => {
    const user = userEvent.setup();
    openDialog();
    await screen.findByRole('option', { name: 'Mobile' });
    await user.type(screen.getByLabelText('Name'), 'Zoë');
    await user.selectOptions(screen.getByLabelText('Category'), 'Mobile');
    await user.type(screen.getByLabelText('Rate per hour'), '100000000.01');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('The amount is too large')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('says so when the people could not be loaded, and still lets a resource be saved without one', async () => {
    serve({ people: 'fail' });
    openDialog();
    expect(await screen.findByText('People could not be loaded.')).toBeInTheDocument();
  });
});

describe('ResourceFormDialog: editing', () => {
  it('opens on the resource and sends PATCH, with null for a cleared person', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ resource: asha });
    expect(screen.getByRole('dialog', { name: 'Edit resource' })).toBeInTheDocument();
    await screen.findByRole('option', { name: 'Ben Cho' });
    expect(screen.getByLabelText('Name')).toHaveValue('Asha Rao');
    expect(screen.getByLabelText('Person')).toHaveValue('1');
    expect(screen.getByLabelText('Category')).toHaveValue('2');
    expect(screen.getByLabelText('Rate per hour')).toHaveValue('150.00');
    await user.selectOptions(screen.getByLabelText('Person'), 'None');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).not.toHaveBeenCalled();
    expect(coreApi.patch).toHaveBeenCalledWith('/project-resources/1', {
      name: 'Asha Rao',
      personId: null,
      categoryId: 2,
      headcount: 1,
      rateCents: 15000,
    });
  });

  it('keeps the linked person as an option while the people are still loading', async () => {
    vi.mocked(coreApi.get).mockImplementation((() => new Promise(() => undefined)) as never);
    openDialog({ resource: asha });
    expect(screen.getByLabelText('Person')).toHaveValue('1');
    expect(screen.getByRole('option', { name: 'Asha Rao' })).toBeInTheDocument();
  });

  it('opens on None and Choose for a person and a category the service no longer lists, and asks for a category', async () => {
    const [orphan] = resourceRowsSchema.parse([{ ...resourceRows[0], person: null, category: null }]);
    const user = userEvent.setup();
    openDialog({ resource: orphan });
    await screen.findByRole('option', { name: 'Mobile' });
    expect(screen.getByLabelText('Person')).toHaveValue('');
    expect(screen.getByLabelText('Category')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Choose a category')).toBeInTheDocument();
    expect(coreApi.patch).not.toHaveBeenCalled();
  });
});

describe('ResourceFormDialog: failures', () => {
  async function submitFilledForm(resource?: ResourceRow) {
    const user = userEvent.setup();
    openDialog({ resource });
    await screen.findByRole('option', { name: 'Mobile' });
    if (!resource) {
      await user.type(screen.getByLabelText('Name'), 'Zoë');
      await user.selectOptions(screen.getByLabelText('Category'), 'Mobile');
      await user.type(screen.getByLabelText('Rate per hour'), '85');
    }
    await user.click(screen.getByRole('button', { name: 'Save' }));
  }

  it('says so, and stays open, when an add fails for any other reason', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(failure(500));
    await submitFilledForm();
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save. Try again.');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('does not offer a retry that cannot work when the project, person or category is gone (409 on add)', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(failure(409));
    await submitFilledForm();
    expect(await screen.findByRole('alert')).toHaveTextContent(CHANGED_ELSEWHERE);
  });

  it('does not offer a retry that cannot work when the resource was removed elsewhere (404 on edit)', async () => {
    vi.mocked(coreApi.patch).mockRejectedValue(failure(404));
    await submitFilledForm(asha);
    expect(await screen.findByRole('alert')).toHaveTextContent(CHANGED_ELSEWHERE);
  });

  it.each([
    ['a 404 on add', 'post', undefined, 404],
    ['a 409 on edit', 'patch', asha, 409],
  ] as const)('still offers a retry for %s', async (_label, method, resource, status) => {
    vi.mocked(coreApi[method]).mockRejectedValue(failure(status));
    await submitFilledForm(resource);
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save. Try again.');
  });
});

describe('ResourceFormDialog: number of people', () => {
  it('starts at 1, with a hint, and sends the number typed', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog();
    await screen.findByRole('option', { name: 'Mobile' });
    expect(screen.getByLabelText('Number of people')).toHaveValue('1');
    expect(screen.getByText('How many people this row stands for.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), 'Fullstack Developer');
    await user.selectOptions(screen.getByLabelText('Category'), 'Mobile');
    await user.clear(screen.getByLabelText('Number of people'));
    await user.type(screen.getByLabelText('Number of people'), '3');
    await user.type(screen.getByLabelText('Rate per hour'), '27');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/project-resources', {
      projectId: 1,
      name: 'Fullstack Developer',
      personId: null,
      categoryId: 2,
      headcount: 3,
      rateCents: 2700,
    });
  });

  it.each(['0', '1001', '2.5', ''])('refuses %j people and sends nothing', async (people) => {
    const user = userEvent.setup();
    openDialog();
    await screen.findByRole('option', { name: 'Mobile' });
    await user.type(screen.getByLabelText('Name'), 'Zoë');
    await user.selectOptions(screen.getByLabelText('Category'), 'Mobile');
    await user.type(screen.getByLabelText('Rate per hour'), '85');
    await user.clear(screen.getByLabelText('Number of people'));
    if (people) await user.type(screen.getByLabelText('Number of people'), people);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Number of people is required|Enter a whole number from 1 to 1,000/)).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('opens on the resource’s headcount', async () => {
    openDialog({ resource: asha });
    expect(screen.getByLabelText('Number of people')).toHaveValue('1');
  });
});
