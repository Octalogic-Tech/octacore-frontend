import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { coreApi } from '@/lib/core-api';
import { allocationEnvelope, allocationRows } from '@/test/fixtures/allocations';
import { peopleEnvelope } from '@/test/fixtures/people';
import { projectsEnvelope } from '@/test/fixtures/projects';
import { renderWithProviders } from '@/test/utils';
import { AllocationFormDialog } from './allocation-form-dialog';
import { allocationRowsSchema, type AllocationRow } from './schema';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

// A fixed "today", so a new entry's default date can be checked against an exact day.
vi.mock('@/lib/format', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/format')>()),
  localToday: () => '2026-10-20',
}));

const [, adaOnWebsite, , adaOnBench] = allocationRowsSchema.parse(allocationRows);

const onOpenChange = vi.fn();

const DUPLICATE = 'This person already has an entry on that date; edit it instead';

/** What the service answers a save with; the dialog does not read it. */
const saved = { data: allocationEnvelope() };

const failure = (status: number, message = 'refused') =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, {
    status,
    data: { statusCode: status, message, data: null },
    statusText: String(status),
    headers: {},
    config: {} as never,
  });

type Served = { people?: 'fail' | unknown; projects?: 'fail' | unknown };

const serve = ({ people, projects }: Served = {}) =>
  vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
    if (path === '/people') {
      if (people === 'fail') throw new Error('down');
      return { data: people ?? peopleEnvelope() };
    }
    if (path === '/projects') {
      if (projects === 'fail') throw new Error('down');
      return { data: projects ?? projectsEnvelope() };
    }
    throw new Error(`unexpected GET ${path}`);
  }) as never);

function openDialog(props: { entry?: AllocationRow; personId?: number } = {}) {
  return renderWithProviders(
    <AllocationFormDialog open onOpenChange={onOpenChange} fallbackFocusId="allocation-search" {...props} />,
  );
}

const optionNames = (select: HTMLElement) =>
  within(select)
    .getAllByRole('option')
    .map((option) => option.textContent);

beforeEach(() => {
  serve();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('AllocationFormDialog: adding', () => {
  it('opens dated today, on the bench option, with nobody chosen', async () => {
    openDialog();
    expect(screen.getByRole('dialog', { name: 'New allocation entry' })).toBeInTheDocument();
    expect(screen.getByLabelText('Effective date')).toHaveValue('2026-10-20');
    expect(screen.getByLabelText('Project')).toHaveValue('bench');
    expect(screen.getByLabelText('Person')).toHaveValue('');
    expect(screen.getByLabelText('Note')).toHaveValue('');
    await screen.findByRole('option', { name: 'Ada Lovelace' });
  });

  it('offers the bench first, then every project by name, whatever its status', async () => {
    openDialog();
    await screen.findByRole('option', { name: 'Website' });
    // Website is active, Mobile app is on hold and Legacy portal is completed: all are offered.
    expect(optionNames(screen.getByLabelText('Project'))).toEqual(['Bench', 'Legacy portal', 'Mobile app', 'Website']);
  });

  it('offers every person, A to Z, after a prompt to choose one', async () => {
    openDialog();
    await screen.findByRole('option', { name: 'Ada Lovelace' });
    expect(optionNames(screen.getByLabelText('Person'))).toEqual([
      'Choose…',
      'Ada Lovelace',
      'Grace Hopper',
      'Linus Torvalds',
    ]);
  });

  it('puts a person on the bench from today, with no note: posts the person, a null project, the date and a null note', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog();
    await screen.findByRole('option', { name: 'Ada Lovelace' });
    await user.selectOptions(screen.getByLabelText('Person'), 'Ada Lovelace');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledTimes(1);
    expect(coreApi.post).toHaveBeenCalledWith('/allocations', {
      personId: 1,
      projectId: null,
      effectiveDate: '2026-10-20',
      note: null,
    });
  });

  it('puts a person on a project from an earlier date, with a note, to fill in history', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog();
    await screen.findByRole('option', { name: 'Grace Hopper' });
    await user.selectOptions(screen.getByLabelText('Person'), 'Grace Hopper');
    await user.selectOptions(screen.getByLabelText('Project'), 'Website');
    await user.clear(screen.getByLabelText('Effective date'));
    await user.type(screen.getByLabelText('Effective date'), '2026-01-05');
    await user.type(screen.getByLabelText('Note'), '  Joined the team  ');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/allocations', {
      personId: 2,
      projectId: 1,
      effectiveDate: '2026-01-05',
      note: 'Joined the team',
    });
  });

  it('asks for a person, and saves nothing without one', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Choose a person')).toBeInTheDocument();
    expect(screen.getByLabelText('Person')).toHaveAttribute('aria-invalid', 'true');
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('asks for a date, and saves nothing without one', async () => {
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await user.clear(screen.getByLabelText('Effective date'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Effective date is required')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('says how the date works: from that day on, and a past date fills in history', () => {
    openDialog();
    expect(screen.getByText(/from this day on/i)).toBeInTheDocument();
  });

  it('does not ask for the person when it is given: it is that person’s entry, and goes under their id', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ personId: 3 });
    expect(screen.queryByLabelText('Person')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/allocations', expect.objectContaining({ personId: 3 }));
  });

  it('says so, on the date, when the person already has an entry that day, and keeps the dialog open', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(failure(409, DUPLICATE));
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(DUPLICATE)).toBeInTheDocument();
    expect(screen.getByLabelText('Effective date')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Effective date')).toHaveFocus();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('saves again under another date after a clash, and closes', async () => {
    vi.mocked(coreApi.post).mockRejectedValueOnce(failure(409, DUPLICATE)).mockResolvedValueOnce(saved);
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(DUPLICATE);
    await user.clear(screen.getByLabelText('Effective date'));
    await user.type(screen.getByLabelText('Effective date'), '2026-10-21');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenNthCalledWith(2, '/allocations', expect.objectContaining({ effectiveDate: '2026-10-21' }));
  });

  it('shows the service’s own words for any other refusal it wrote for people', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(failure(409, 'Referenced record does not exist'));
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Referenced record does not exist');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('keeps the dialog open and says so when the save fails, and saves the same entry again on a retry', async () => {
    vi.mocked(coreApi.post).mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(saved);
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save. Try again.');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledTimes(2);
  });

  it('does not read the answer to a save, so an answer it does not know cannot look like a failed save', async () => {
    vi.mocked(coreApi.post).mockResolvedValue({ data: { surprise: true } });
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says so when the people could not be loaded, and the projects too, and still offers the bench', async () => {
    serve({ people: 'fail', projects: 'fail' });
    openDialog();
    expect(await screen.findByText('People could not be loaded.')).toBeInTheDocument();
    expect(await screen.findByText('Projects could not be loaded.')).toBeInTheDocument();
    expect(optionNames(screen.getByLabelText('Project'))).toEqual(['Bench']);
  });

  it('closes without saving on Cancel', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(coreApi.post).not.toHaveBeenCalled();
  });
});

describe('AllocationFormDialog: editing', () => {
  it('opens on the entry: the person as text it cannot change, the project, the date and the note', () => {
    openDialog({ entry: adaOnBench });
    expect(screen.getByRole('dialog', { name: 'Edit allocation entry' })).toBeInTheDocument();
    expect(screen.getByLabelText('Person')).toHaveValue('Ada Lovelace');
    expect(screen.getByLabelText('Person')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Project')).toHaveValue('bench');
    expect(screen.getByLabelText('Effective date')).toHaveValue('2025-11-03');
    expect(screen.getByLabelText('Note')).toHaveValue('Joined, not on a project yet');
  });

  it('opens an entry on a project with the project chosen, before the project list has arrived', () => {
    openDialog({ entry: adaOnWebsite });
    expect(screen.getByLabelText('Project')).toHaveValue('1');
    expect(screen.getByLabelText('Note')).toHaveValue('');
  });

  it('changes the entry with PATCH under its id, and sends the project, the date and the note but not the person', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ entry: adaOnWebsite });
    await screen.findByRole('option', { name: 'Legacy portal' });
    await user.selectOptions(screen.getByLabelText('Project'), 'Bench');
    await user.clear(screen.getByLabelText('Effective date'));
    await user.type(screen.getByLabelText('Effective date'), '2026-03-15');
    await user.type(screen.getByLabelText('Note'), 'Rolled off');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).not.toHaveBeenCalled();
    expect(coreApi.patch).toHaveBeenCalledTimes(1);
    expect(coreApi.patch).toHaveBeenCalledWith('/allocations/3', {
      projectId: null,
      effectiveDate: '2026-03-15',
      note: 'Rolled off',
    });
  });

  it('sends the entry back as it was when it is saved without a change', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ entry: adaOnWebsite });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/allocations/3', {
      projectId: 1,
      effectiveDate: '2026-03-12',
      note: null,
    });
  });

  it('sends a null note to clear it when the field is emptied', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ entry: adaOnBench });
    await user.clear(screen.getByLabelText('Note'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/allocations/1', expect.objectContaining({ projectId: null, note: null }));
  });

  it('still offers and keeps a project that has since been deleted, so an edit cannot move the entry off it', async () => {
    const retired = { ...allocationRows[1], projectId: 99, project: { id: 99, name: 'Retired project' } };
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ entry: allocationRowsSchema.parse([retired])[0] });
    await screen.findByRole('option', { name: 'Website' });
    expect(screen.getByLabelText('Project')).toHaveValue('99');
    expect(screen.getByRole('option', { name: 'Retired project' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/allocations/3', expect.objectContaining({ projectId: 99 }));
  });

  it('keeps the project of the entry chosen while the projects fail to load', async () => {
    serve({ projects: 'fail' });
    openDialog({ entry: adaOnWebsite });
    expect(await screen.findByText('Projects could not be loaded.')).toBeInTheDocument();
    expect(screen.getByLabelText('Project')).toHaveValue('1');
    expect(optionNames(screen.getByLabelText('Project'))).toEqual(['Bench', 'Website']);
  });

  it('says so on the date when it now clashes with another entry of the person', async () => {
    vi.mocked(coreApi.patch).mockRejectedValue(failure(409, DUPLICATE));
    const user = userEvent.setup();
    openDialog({ entry: adaOnWebsite });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(DUPLICATE)).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('says the entry was removed elsewhere, rather than offering a retry that cannot work, when it is gone', async () => {
    vi.mocked(coreApi.patch).mockRejectedValue(failure(404));
    const user = userEvent.setup();
    openDialog({ entry: adaOnWebsite });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This entry was removed elsewhere, so it cannot be saved. Close this dialog and go back to the ledger.',
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('closes without saving on Cancel', async () => {
    const user = userEvent.setup();
    openDialog({ entry: adaOnWebsite });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(coreApi.patch).not.toHaveBeenCalled();
  });
});
