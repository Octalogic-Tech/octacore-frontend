import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { coreApi } from '@/lib/core-api';
import { allocationEnvelope, allocationRows, allocationsEnvelope } from '@/test/fixtures/allocations';
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

const DUPLICATE = 'This person already has an entry for that card on that date; edit it instead';

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

type Served = { people?: 'fail' | unknown; projects?: 'fail' | unknown; entries?: unknown[] };

/** The service filters entries by person; the stand-in does too. `entries` are what the service holds. */
const serve = ({ people, projects, entries = allocationRows }: Served = {}) =>
  vi.mocked(coreApi.get).mockImplementation((async (path: string, config?: { params?: { personId?: number } }) => {
    if (path === '/allocations') {
      const personId = config?.params?.personId;
      return {
        data: allocationsEnvelope(
          personId === undefined ? entries : entries.filter((row) => (row as { personId: number }).personId === personId),
        ),
      };
    }
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

  it('offers the bench first, then every project by name, whatever its status, and "Card removed" last', async () => {
    openDialog();
    await screen.findByRole('option', { name: 'Website' });
    // Website is active, Mobile app is on hold and Legacy portal is completed: all are offered.
    expect(optionNames(screen.getByLabelText('Project'))).toEqual(['Bench', 'Legacy portal', 'Mobile app', 'Website', 'Card removed']);
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
      card: 1,
      projectId: null,
      removed: false,
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
      card: 1,
      projectId: 1,
      removed: false,
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
    expect(optionNames(screen.getByLabelText('Project'))).toEqual(['Bench', 'Card removed']);
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

  it('changes the entry with PATCH under its id, and sends the new project, the date and the note but not the person', async () => {
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

  it('sends the entry back as it was when it is saved without a change: the project is not named, since it did not change', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ entry: adaOnWebsite });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/allocations/3', {
      effectiveDate: '2026-03-12',
      note: null,
    });
  });

  it('sends the project when another one is chosen, and null for the bench', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ entry: adaOnWebsite });
    await screen.findByRole('option', { name: 'Legacy portal' });
    await user.selectOptions(screen.getByLabelText('Project'), 'Legacy portal');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenLastCalledWith('/allocations/3', expect.objectContaining({ projectId: 3 }));
  });

  it('sends the project when an entry on the bench is put on a project', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ entry: adaOnBench });
    await screen.findByRole('option', { name: 'Website' });
    await user.selectOptions(screen.getByLabelText('Project'), 'Website');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/allocations/1', expect.objectContaining({ projectId: 1 }));
  });

  it('sends a null note to clear it when the field is emptied', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ entry: adaOnBench });
    await user.clear(screen.getByLabelText('Note'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/allocations/1', { effectiveDate: '2025-11-03', note: null });
  });

  it('still offers and keeps a project that has since been deleted, and does not name it, which the service would refuse', async () => {
    const retired = { ...allocationRows[1], projectId: 99, project: { id: 99, name: 'Retired project' } };
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ entry: allocationRowsSchema.parse([retired])[0] });
    await screen.findByRole('option', { name: 'Website' });
    expect(screen.getByLabelText('Project')).toHaveValue('99');
    expect(screen.getByRole('option', { name: 'Retired project' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/allocations/3', { effectiveDate: '2026-03-12', note: null });
    expect(vi.mocked(coreApi.patch).mock.calls[0][1]).not.toHaveProperty('projectId');
  });

  it('changes only the note of an entry of a deleted project without naming the project', async () => {
    const retired = { ...allocationRows[1], projectId: 99, project: { id: 99, name: 'Retired project' } };
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ entry: allocationRowsSchema.parse([retired])[0] });
    await user.type(screen.getByLabelText('Note'), 'Handed over');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/allocations/3', { effectiveDate: '2026-03-12', note: 'Handed over' });
  });

  it('moves an entry of a deleted project to a live one, or to the bench, by naming that', async () => {
    const retired = { ...allocationRows[1], projectId: 99, project: { id: 99, name: 'Retired project' } };
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ entry: allocationRowsSchema.parse([retired])[0] });
    await screen.findByRole('option', { name: 'Website' });
    await user.selectOptions(screen.getByLabelText('Project'), 'Bench');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/allocations/3', expect.objectContaining({ projectId: null }));
  });

  it('keeps the project of the entry chosen while the projects fail to load', async () => {
    serve({ projects: 'fail' });
    openDialog({ entry: adaOnWebsite });
    expect(await screen.findByText('Projects could not be loaded.')).toBeInTheDocument();
    expect(screen.getByLabelText('Project')).toHaveValue('1');
    expect(optionNames(screen.getByLabelText('Project'))).toEqual(['Bench', 'Website', 'Card removed']);
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

describe('AllocationFormDialog: cards', () => {
  const secondCard = { ...allocationRows[1], id: 20, card: 2, projectId: 2, project: { id: 2, name: 'Mobile app' }, effectiveDate: '2026-06-01' };
  const removedSecond = { ...allocationRows[1], id: 21, card: 2, removed: true, projectId: null, project: null, effectiveDate: '2026-07-01' };
  const secondOfAda = allocationRowsSchema.parse([secondCard])[0];
  const removalOfAda = allocationRowsSchema.parse([removedSecond])[0];

  it('opens a new entry on Card 1, offering the card numbers the person has and a new card', async () => {
    serve({ entries: [secondCard, ...allocationRows] });
    openDialog({ personId: 1 });
    expect(screen.getByLabelText('Card')).toHaveValue('1');
    await waitFor(() => expect(optionNames(screen.getByLabelText('Card'))).toEqual(['Card 1', 'Card 2', 'New card']));
  });

  it('offers only Card 1 and a new card to a person with no entries', async () => {
    serve({ entries: [] });
    openDialog({ personId: 3 });
    await waitFor(() => expect(coreApi.get).toHaveBeenCalledWith('/allocations', { params: { personId: 3 } }));
    expect(optionNames(screen.getByLabelText('Card'))).toEqual(['Card 1', 'New card']);
  });

  it('offers the cards of the person chosen, and goes back to Card 1 when another person is chosen', async () => {
    serve({ entries: [secondCard, ...allocationRows] });
    const user = userEvent.setup();
    openDialog();
    await screen.findByRole('option', { name: 'Ada Lovelace' });
    await user.selectOptions(screen.getByLabelText('Person'), 'Ada Lovelace');
    await waitFor(() => expect(optionNames(screen.getByLabelText('Card'))).toEqual(['Card 1', 'Card 2', 'New card']));
    await user.selectOptions(screen.getByLabelText('Card'), 'Card 2');
    await user.selectOptions(screen.getByLabelText('Person'), 'Grace Hopper');
    await waitFor(() => expect(optionNames(screen.getByLabelText('Card'))).toEqual(['Card 1', 'New card']));
    expect(screen.getByLabelText('Card')).toHaveValue('1');
  });

  it('adds an entry for another card of the person, with that card’s number', async () => {
    serve({ entries: [secondCard, ...allocationRows] });
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await waitFor(() => expect(optionNames(screen.getByLabelText('Card'))).toContain('Card 2'));
    await user.selectOptions(screen.getByLabelText('Card'), 'Card 2');
    await screen.findByRole('option', { name: 'Website' });
    await user.selectOptions(screen.getByLabelText('Project'), 'Website');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/allocations', {
      personId: 1,
      card: 2,
      projectId: 1,
      removed: false,
      effectiveDate: '2026-10-20',
      note: null,
    });
  });

  it('adds a new card through the cards endpoint, not as an entry: the person, the project, the date and the note', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await user.selectOptions(screen.getByLabelText('Card'), 'New card');
    await screen.findByRole('option', { name: 'Website' });
    await user.selectOptions(screen.getByLabelText('Project'), 'Website');
    await user.type(screen.getByLabelText('Note'), 'Also on the web build');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledTimes(1);
    expect(coreApi.post).toHaveBeenCalledWith('/allocations/cards', {
      personId: 1,
      projectId: 1,
      effectiveDate: '2026-10-20',
      note: 'Also on the web build',
    });
  });

  it('adds a new card on the bench with a null project and no note', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await user.selectOptions(screen.getByLabelText('Card'), 'New card');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/allocations/cards', {
      personId: 1,
      projectId: null,
      effectiveDate: '2026-10-20',
      note: null,
    });
  });

  it('does not let a new card be one that is removed', async () => {
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await user.selectOptions(screen.getByLabelText('Card'), 'New card');
    await user.selectOptions(screen.getByLabelText('Project'), 'Card removed');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('A new card cannot be removed')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('offers "Card removed" as the last choice of the Project select', async () => {
    openDialog({ personId: 1 });
    await screen.findByRole('option', { name: 'Website' });
    expect(optionNames(screen.getByLabelText('Project'))).toEqual([
      'Bench',
      'Legacy portal',
      'Mobile app',
      'Website',
      'Card removed',
    ]);
  });

  it('adds an entry that removes a card, with no project', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await user.selectOptions(screen.getByLabelText('Project'), 'Card removed');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/allocations', expect.objectContaining({ card: 1, projectId: null, removed: true }));
  });

  it('shows a clash on the date in the service’s words when the card has an entry that day', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(failure(409, DUPLICATE));
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(DUPLICATE)).toBeInTheDocument();
    expect(screen.getByLabelText('Effective date')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows the service’s refusal of a card that does not exist, and of a new card, above the buttons', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(failure(409, 'That card does not exist'));
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That card does not exist');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('shows the card of an entry being edited as text it cannot change', () => {
    openDialog({ entry: secondOfAda });
    expect(screen.getByLabelText('Card')).toHaveValue('Card 2');
    expect(screen.getByLabelText('Card')).toHaveAttribute('readonly');
  });

  it('edits an entry of another card without sending the card or the person', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ entry: secondOfAda });
    await user.type(screen.getByLabelText('Note'), 'Handed over');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/allocations/20', { effectiveDate: '2026-06-01', note: 'Handed over' });
  });

  it('opens an entry that removes a card on "Card removed", and sends nothing about it when it is saved unchanged', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ entry: removalOfAda });
    expect(screen.getByLabelText('Project')).toHaveValue('removed');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/allocations/21', { effectiveDate: '2026-07-01', note: null });
  });

  it('turns an entry on a project into the removal of its card: no project, removed', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ entry: secondOfAda });
    await user.selectOptions(screen.getByLabelText('Project'), 'Card removed');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/allocations/20', {
      projectId: null,
      removed: true,
      effectiveDate: '2026-06-01',
      note: null,
    });
  });

  it('turns the removal of a card into a placement again: the project and removed false', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ entry: removalOfAda });
    await screen.findByRole('option', { name: 'Website' });
    await user.selectOptions(screen.getByLabelText('Project'), 'Website');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/allocations/21', {
      projectId: 1,
      removed: false,
      effectiveDate: '2026-07-01',
      note: null,
    });
  });

  it('turns the removal of a card into the bench with removed false alone', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ entry: removalOfAda });
    await user.selectOptions(screen.getByLabelText('Project'), 'Bench');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/allocations/21', {
      removed: false,
      effectiveDate: '2026-07-01',
      note: null,
    });
  });
});
