import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { coreApi } from '@/lib/core-api';
import { allocationEnvelope, allocationRows, allocationsEnvelope } from '@/test/fixtures/allocations';
import { peopleEnvelope } from '@/test/fixtures/people';
import { projectsEnvelope } from '@/test/fixtures/projects';
import { renderWithProviders } from '@/test/utils';
import { AllocationLedger } from './allocation-ledger';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

// A fixed "today", so what is upcoming and a new entry's date can be checked against exact days.
vi.mock('@/lib/format', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/format')>()),
  localToday: () => '2026-10-20',
}));

/** The service filters by person; the stand-in does the same, so a person's ledger reads what the service would send. */
const serve = (entries: unknown[] = allocationRows) =>
  vi.mocked(coreApi.get).mockImplementation((async (path: string, config?: { params?: { personId?: number } }) => {
    if (path === '/allocations') {
      const personId = config?.params?.personId;
      return {
        data: allocationsEnvelope(
          personId === undefined ? entries : entries.filter((entry) => (entry as { personId: number }).personId === personId),
        ),
      };
    }
    if (path === '/people') return { data: peopleEnvelope() };
    if (path === '/projects') return { data: projectsEnvelope() };
    throw new Error(`unexpected GET ${path}`);
  }) as never);

/** What the service answers a save or a delete with; the ledger does not read it. */
const saved = { data: allocationEnvelope() };

const rowOf = async (text: string) => within((await screen.findByText(text)).closest('tr') as HTMLElement);

/** Each body row as its cells' text, in the order shown. */
const bodyRows = () =>
  within(screen.getByRole('table', { name: 'Allocation ledger' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .slice(0, -1)
        .map((cell) => cell.textContent),
    );

beforeEach(() => {
  serve();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('AllocationLedger: reading', () => {
  it('asks the service for every entry', async () => {
    renderWithProviders(<AllocationLedger />);
    await screen.findByRole('table', { name: 'Allocation ledger' });
    expect(coreApi.get).toHaveBeenCalledWith('/allocations', { params: undefined });
  });

  it('lists the entries newest first, each with its person, project or Bench, and note', async () => {
    renderWithProviders(<AllocationLedger />);
    await screen.findByRole('table', { name: 'Allocation ledger' });
    expect(bodyRows()).toEqual([
      ['3 Aug 2026', 'Grace Hopper', 'Card 1', 'Bench', 'Between projects'],
      ['12 Mar 2026', 'Ada Lovelace', 'Card 1', 'Website', '—'],
      ['5 Jan 2026', 'Grace Hopper', 'Card 1', 'Mobile app', '—'],
      ['3 Nov 2025', 'Ada Lovelace', 'Card 1', 'Bench', 'Joined, not on a project yet'],
    ]);
    expect(screen.getByText('1–4 of 4')).toBeInTheDocument();
  });

  it('keeps the name of a project that was deleted later, which is what keeps history readable', async () => {
    const retired = { ...allocationRows[1], project: { id: 99, name: 'Retired project' }, projectId: 99 };
    serve([retired]);
    renderWithProviders(<AllocationLedger />);
    expect((await rowOf('Retired project')).getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('says Upcoming on an entry that starts after today, and on no other', async () => {
    const future = { ...allocationRows[1], id: 9, effectiveDate: '2026-10-21' };
    const today = { ...allocationRows[2], id: 8, effectiveDate: '2026-10-20' };
    serve([future, today, ...allocationRows]);
    renderWithProviders(<AllocationLedger />);
    const upcoming = await screen.findAllByText('Upcoming');
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].closest('tr')).toHaveTextContent('21 Oct 2026');
    expect((await rowOf('20 Oct 2026')).queryByText('Upcoming')).not.toBeInTheDocument();
  });

  it('narrows to a project by its name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AllocationLedger />);
    await screen.findByRole('table', { name: 'Allocation ledger' });
    await user.type(screen.getByLabelText('Search entries'), 'WEBSITE');
    expect(bodyRows()).toEqual([['12 Mar 2026', 'Ada Lovelace', 'Card 1', 'Website', '—']]);
  });

  it('narrows to a person by their name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AllocationLedger />);
    await screen.findByRole('table', { name: 'Allocation ledger' });
    await user.type(screen.getByLabelText('Search entries'), 'grace');
    expect(bodyRows().map((cells) => cells[1])).toEqual(['Grace Hopper', 'Grace Hopper']);
  });

  it('finds the entries on the bench by the word Bench', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AllocationLedger />);
    await screen.findByRole('table', { name: 'Allocation ledger' });
    await user.type(screen.getByLabelText('Search entries'), 'bench');
    expect(bodyRows().map((cells) => cells[3])).toEqual(['Bench', 'Bench']);
  });

  it('says so when nothing matches the search', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AllocationLedger />);
    await screen.findByRole('table', { name: 'Allocation ledger' });
    await user.type(screen.getByLabelText('Search entries'), 'zzz');
    expect(screen.getByText('No entries match “zzz”.')).toBeInTheDocument();
  });

  it('pages a long ledger', async () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      ...allocationRows[1],
      id: 100 - index,
      effectiveDate: `2026-03-${String(20 - index).padStart(2, '0')}`,
    }));
    serve(many);
    const user = userEvent.setup();
    renderWithProviders(<AllocationLedger />);
    expect(await screen.findByText('1–10 of 12')).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(10);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('11–12 of 12')).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(2);
  });
});

describe('AllocationLedger: cards', () => {
  const card2 = { ...allocationRows[1], id: 20, card: 2, projectId: 2, project: { id: 2, name: 'Mobile app' }, effectiveDate: '2026-06-01' };
  const removal = { ...allocationRows[1], id: 21, card: 2, removed: true, projectId: null, project: null, effectiveDate: '2026-07-01' };

  it('has a Card column, and says "Card 2" for an entry of a person’s second card', async () => {
    serve([allocationRows[0], card2, ...allocationRows.slice(1)]);
    renderWithProviders(<AllocationLedger />);
    await screen.findByRole('table', { name: 'Allocation ledger' });
    expect(screen.getByRole('columnheader', { name: 'Card' })).toBeInTheDocument();
    expect(bodyRows().map((cells) => [cells[1], cells[2], cells[3]])).toEqual([
      ['Grace Hopper', 'Card 1', 'Bench'],
      ['Ada Lovelace', 'Card 2', 'Mobile app'],
      ['Ada Lovelace', 'Card 1', 'Website'],
      ['Grace Hopper', 'Card 1', 'Mobile app'],
      ['Ada Lovelace', 'Card 1', 'Bench'],
    ]);
  });

  it('reads an entry that removes a card as "Card removed" in the Project column', async () => {
    serve([allocationRows[0], removal, card2, ...allocationRows.slice(1)]);
    renderWithProviders(<AllocationLedger />);
    await screen.findByRole('table', { name: 'Allocation ledger' });
    expect(bodyRows()[1]).toEqual(['1 Jul 2026', 'Ada Lovelace', 'Card 2', 'Card removed', '—']);
  });

  it('shows the Card column on a person’s own ledger too', async () => {
    serve([card2, ...allocationRows]);
    renderWithProviders(<AllocationLedger personId={1} />);
    await screen.findByRole('table', { name: 'Allocation ledger' });
    expect(screen.getByRole('columnheader', { name: 'Card' })).toBeInTheDocument();
    expect(bodyRows().map((cells) => [cells[0], cells[1], cells[2]])).toEqual([
      ['1 Jun 2026', 'Card 2', 'Mobile app'],
      ['12 Mar 2026', 'Card 1', 'Website'],
      ['3 Nov 2025', 'Card 1', 'Bench'],
    ]);
  });

  it('narrows to a card by its number, and finds removed entries by "removed"', async () => {
    serve([removal, card2, ...allocationRows]);
    const user = userEvent.setup();
    renderWithProviders(<AllocationLedger />);
    await screen.findByRole('table', { name: 'Allocation ledger' });
    await user.type(screen.getByLabelText('Search entries'), 'card 2');
    expect(bodyRows().map((cells) => cells[3])).toEqual(['Card removed', 'Mobile app']);
    await user.clear(screen.getByLabelText('Search entries'));
    await user.type(screen.getByLabelText('Search entries'), 'removed');
    expect(bodyRows()).toHaveLength(1);
  });

  it('names the actions of an entry of another card by its card, since two cards can have entries on one day', async () => {
    serve([{ ...card2, effectiveDate: '2026-03-12' }, ...allocationRows]);
    renderWithProviders(<AllocationLedger />);
    expect(await screen.findByRole('button', { name: 'Edit Ada Lovelace from 12 Mar 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Ada Lovelace from 12 Mar 2026, card 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Ada Lovelace from 12 Mar 2026, card 2' })).toBeInTheDocument();
  });

  it('says in the confirmation which card an entry was for, and what it said', async () => {
    serve([removal, card2, ...allocationRows]);
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<AllocationLedger />);
    await user.click(await screen.findByRole('button', { name: 'Delete Ada Lovelace from 1 Jul 2026, card 2' }));
    expect(screen.getByText('Delete the entry for “Ada Lovelace” (card 2) from 1 Jul 2026?')).toBeInTheDocument();
    expect(screen.getByText(/Their card 2 was removed from that day\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Delete Ada Lovelace from 1 Jun 2026, card 2' }));
    expect(screen.getByText(/Their card 2 was on Mobile app from that day\./)).toBeInTheDocument();
  });

  it('opens an entry of another card to edit with its card shown and fixed', async () => {
    serve([card2, ...allocationRows]);
    const user = userEvent.setup();
    renderWithProviders(<AllocationLedger />);
    await user.click(await screen.findByRole('button', { name: 'Edit Ada Lovelace from 1 Jun 2026, card 2' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit allocation entry' });
    expect(within(dialog).getByLabelText('Card')).toHaveValue('Card 2');
    expect(within(dialog).getByLabelText('Card')).toHaveAttribute('readonly');
  });
});

describe('AllocationLedger: one person’s', () => {
  it('asks the service for only that person’s entries', async () => {
    renderWithProviders(<AllocationLedger personId={1} />);
    await screen.findByRole('table', { name: 'Allocation ledger' });
    expect(coreApi.get).toHaveBeenCalledWith('/allocations', { params: { personId: 1 } });
    expect(bodyRows().map((cells) => cells[0])).toEqual(['12 Mar 2026', '3 Nov 2025']);
  });

  it('has no Person column, since every row is the same person', async () => {
    renderWithProviders(<AllocationLedger personId={1} />);
    await screen.findByRole('table', { name: 'Allocation ledger' });
    expect(screen.queryByRole('columnheader', { name: 'Person' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Project' })).toBeInTheDocument();
    expect(bodyRows()[0]).toEqual(['12 Mar 2026', 'Card 1', 'Website', '—']);
  });

  it('has the Person column on the whole ledger', async () => {
    renderWithProviders(<AllocationLedger />);
    expect(await screen.findByRole('columnheader', { name: 'Person' })).toBeInTheDocument();
  });

  it('adds an entry for that person without asking who, and says there is none yet when there are none', async () => {
    serve([]);
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<AllocationLedger personId={3} />);
    expect(await screen.findByText('No allocations for this person yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add the first entry' }));
    expect(screen.queryByLabelText('Person')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.post).toHaveBeenCalledWith('/allocations', expect.objectContaining({ personId: 3 })));
  });
});

describe('AllocationLedger: adding, editing and deleting', () => {
  it('opens the dialog on today’s date, with the bench as the first choice, to add an entry', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AllocationLedger />);
    await user.click(await screen.findByRole('button', { name: 'Add entry' }));
    const dialog = screen.getByRole('dialog', { name: 'New allocation entry' });
    expect(within(dialog).getByLabelText('Effective date')).toHaveValue('2026-10-20');
    expect(within(dialog).getByLabelText('Project')).toHaveValue('bench');
    expect(within(within(dialog).getByLabelText('Project')).getAllByRole('option')[0]).toHaveTextContent('Bench');
  });

  it('saves a new entry on the bench: the person, a null project, the date and a null note', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<AllocationLedger />);
    await user.click(await screen.findByRole('button', { name: 'Add entry' }));
    await screen.findByRole('option', { name: 'Linus Torvalds' });
    await user.selectOptions(screen.getByLabelText('Person'), 'Linus Torvalds');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(coreApi.post).toHaveBeenCalledWith('/allocations', {
      personId: 3,
      card: 1,
      projectId: null,
      removed: false,
      effectiveDate: '2026-10-20',
      note: null,
    });
  });

  it('reads the ledger again after a save, so the new entry is in it', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<AllocationLedger />);
    await user.click(await screen.findByRole('button', { name: 'Add entry' }));
    await screen.findByRole('option', { name: 'Linus Torvalds' });
    await user.selectOptions(screen.getByLabelText('Person'), 'Linus Torvalds');
    const added = {
      ...allocationRows[0],
      id: 5,
      personId: 3,
      effectiveDate: '2026-10-20',
      person: { id: 3, name: 'Linus Torvalds' },
    };
    vi.mocked(coreApi.post).mockImplementation((async () => {
      serve([added, ...allocationRows]);
      return saved;
    }) as never);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((await rowOf('Linus Torvalds')).getByText('20 Oct 2026')).toBeInTheDocument();
  });

  it('says in the dialog, and keeps it open, when the person already has an entry that day', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(
      new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, {
        status: 409,
        data: { statusCode: 409, message: 'This person already has an entry on that date; edit it instead', data: null },
        statusText: '409',
        headers: {},
        config: {} as never,
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<AllocationLedger />);
    await user.click(await screen.findByRole('button', { name: 'Add entry' }));
    await screen.findByRole('option', { name: 'Ada Lovelace' });
    await user.selectOptions(screen.getByLabelText('Person'), 'Ada Lovelace');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('This person already has an entry on that date; edit it instead'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'New allocation entry' })).toBeInTheDocument();
  });

  it('opens the dialog on an entry to edit it, and changes it with PATCH', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<AllocationLedger />);
    await user.click(await screen.findByRole('button', { name: 'Edit Ada Lovelace from 12 Mar 2026' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit allocation entry' });
    expect(within(dialog).getByLabelText('Person')).toHaveValue('Ada Lovelace');
    expect(within(dialog).getByLabelText('Project')).toHaveValue('1');
    expect(within(dialog).getByLabelText('Effective date')).toHaveValue('2026-03-12');
    await user.type(within(dialog).getByLabelText('Note'), 'Moved to the web team');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(coreApi.post).not.toHaveBeenCalled();
    // The project did not change, so it is not named.
    expect(coreApi.patch).toHaveBeenCalledWith('/allocations/3', {
      effectiveDate: '2026-03-12',
      note: 'Moved to the web team',
    });
  });

  it('deletes an entry only after the confirmation, and says what it does', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<AllocationLedger />);
    await user.click(await screen.findByRole('button', { name: 'Delete Ada Lovelace from 12 Mar 2026' }));
    expect(screen.getByText('Delete the entry for “Ada Lovelace” from 12 Mar 2026?')).toBeInTheDocument();
    expect(screen.getByText(/They were on Website from that day\./)).toBeInTheDocument();
    expect(screen.getByText(/worked out again from their other entries\. This cannot be undone\./)).toBeInTheDocument();
    expect(coreApi.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete entry' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/allocations/3'));
    expect(coreApi.delete).toHaveBeenCalledTimes(1);
  });

  it('says the bench when the entry deleted was the bench', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AllocationLedger />);
    await user.click(await screen.findByRole('button', { name: 'Delete Ada Lovelace from 3 Nov 2025' }));
    expect(screen.getByText(/They were on the bench from that day\./)).toBeInTheDocument();
  });

  it('leaves the entry alone when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AllocationLedger />);
    await user.click(await screen.findByRole('button', { name: 'Delete Ada Lovelace from 12 Mar 2026' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(coreApi.delete).not.toHaveBeenCalled();
    expect(bodyRows()).toHaveLength(4);
  });

  it('moves focus to the search field after a delete removes the row that held it', async () => {
    vi.mocked(coreApi.delete).mockImplementation((async () => {
      serve(allocationRows.filter((row) => row.id !== 3));
      return saved;
    }) as never);
    const user = userEvent.setup();
    renderWithProviders(<AllocationLedger />);
    await user.click(await screen.findByRole('button', { name: 'Delete Ada Lovelace from 12 Mar 2026' }));
    await user.click(screen.getByRole('button', { name: 'Delete entry' }));
    await waitFor(() => expect(screen.getByLabelText('Search entries')).toHaveFocus());
  });
});

describe('AllocationLedger: empty and failed', () => {
  it('offers to add the first entry when there are none', async () => {
    serve([]);
    const user = userEvent.setup();
    renderWithProviders(<AllocationLedger />);
    expect(await screen.findByText('No allocation entries yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add the first entry' }));
    expect(screen.getByRole('dialog', { name: 'New allocation entry' })).toBeInTheDocument();
  });

  it('shows an error with a retry when the entries cannot be loaded, and loads them on the retry', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    renderWithProviders(<AllocationLedger />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    serve();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table', { name: 'Allocation ledger' })).toBeInTheDocument();
  });

  it.each([
    ['a bare array, which is not the service’s envelope', allocationRows],
    ['an entry that has lost its person', allocationsEnvelope([{ ...allocationRows[0], person: undefined }])],
  ])('shows the error state, not a broken table, when the service answers with %s', async (_label, body) => {
    vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
      if (path === '/allocations') return { data: body };
      return { data: path === '/people' ? peopleEnvelope() : projectsEnvelope() };
    }) as never);
    renderWithProviders(<AllocationLedger />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
  });
});
