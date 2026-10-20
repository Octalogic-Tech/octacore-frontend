import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import { leaveEnvelope, leaveRows, leavesEnvelope } from '@/test/fixtures/leaves';
import { peopleEnvelope } from '@/test/fixtures/people';
import { renderWithProviders } from '@/test/utils';
import { LeaveTable } from './leave-table';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

/** The service filters by person; the stand-in does the same, so a person's leaves read what the service would send. */
const serve = (leaves: unknown[] = leaveRows) =>
  vi.mocked(coreApi.get).mockImplementation((async (path: string, config?: { params?: { personId?: number } }) => {
    if (path === '/leaves') {
      const personId = config?.params?.personId;
      return {
        data: leavesEnvelope(
          personId === undefined
            ? leaves
            : leaves.filter((leave) => (leave as { personId: number }).personId === personId)
        ),
      };
    }
    if (path === '/people') return { data: peopleEnvelope() };
    throw new Error(`unexpected GET ${path}`);
  }) as never);

/** What the service answers a save or a delete with; the table does not read it. */
const saved = { data: leaveEnvelope() };

const rowOf = async (text: string) => within((await screen.findByText(text)).closest('tr') as HTMLElement);

/** Each body row as its cells' text, in the order shown. */
const bodyRows = () =>
  within(screen.getByRole('table', { name: 'Leave' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .slice(0, -1)
        .map((cell) => cell.textContent)
    );

beforeEach(() => {
  serve();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('LeaveTable: reading', () => {
  it('asks the service for every leave', async () => {
    renderWithProviders(<LeaveTable />);
    await screen.findByRole('table', { name: 'Leave' });
    expect(coreApi.get).toHaveBeenCalledWith('/leaves', { params: undefined });
  });

  it('lists the leaves newest first, each with its dates, person, type and reason', async () => {
    renderWithProviders(<LeaveTable />);
    await screen.findByRole('table', { name: 'Leave' });
    expect(bodyRows()).toEqual([
      ['21 Aug 2026', 'Grace Hopper', 'Sick', '—'],
      ['12 Mar 2026 to 14 Mar 2026', 'Ada Lovelace', 'Casual', 'Family wedding'],
      ['2 Feb 2026 to 6 Feb 2026', 'Grace Hopper', 'Earned', '—'],
      ['24 Dec 2025 to 31 Dec 2025', 'Ada Lovelace', 'Unpaid', 'Travel'],
    ]);
    expect(screen.getByText('1–4 of 4')).toBeInTheDocument();
  });

  it('narrows to a person by their name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LeaveTable />);
    await screen.findByRole('table', { name: 'Leave' });
    await user.type(screen.getByLabelText('Search leave'), 'GRACE');
    expect(bodyRows().map((cells) => cells[1])).toEqual(['Grace Hopper', 'Grace Hopper']);
  });

  it('narrows to a type by its label', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LeaveTable />);
    await screen.findByRole('table', { name: 'Leave' });
    await user.type(screen.getByLabelText('Search leave'), 'sick');
    expect(bodyRows()).toEqual([['21 Aug 2026', 'Grace Hopper', 'Sick', '—']]);
  });

  it('narrows to a reason', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LeaveTable />);
    await screen.findByRole('table', { name: 'Leave' });
    await user.type(screen.getByLabelText('Search leave'), 'wedding');
    expect(bodyRows()).toEqual([['12 Mar 2026 to 14 Mar 2026', 'Ada Lovelace', 'Casual', 'Family wedding']]);
  });

  it('says so when nothing matches the search', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LeaveTable />);
    await screen.findByRole('table', { name: 'Leave' });
    await user.type(screen.getByLabelText('Search leave'), 'zzz');
    expect(screen.getByText('No leave matches “zzz”.')).toBeInTheDocument();
  });

  it('pages a long register', async () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      ...leaveRows[1],
      id: 100 - index,
      startDate: `2026-03-${String(20 - index).padStart(2, '0')}`,
      endDate: `2026-03-${String(20 - index).padStart(2, '0')}`,
    }));
    serve(many);
    const user = userEvent.setup();
    renderWithProviders(<LeaveTable />);
    expect(await screen.findByText('1–10 of 12')).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(10);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('11–12 of 12')).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(2);
  });
});

describe('LeaveTable: one person’s', () => {
  it('asks the service for only that person’s leaves', async () => {
    renderWithProviders(<LeaveTable personId={1} />);
    await screen.findByRole('table', { name: 'Leave' });
    expect(coreApi.get).toHaveBeenCalledWith('/leaves', { params: { personId: 1 } });
    expect(bodyRows().map((cells) => cells[0])).toEqual(['12 Mar 2026 to 14 Mar 2026', '24 Dec 2025 to 31 Dec 2025']);
  });

  it('has no Person column, since every row is the same person', async () => {
    renderWithProviders(<LeaveTable personId={1} />);
    await screen.findByRole('table', { name: 'Leave' });
    expect(screen.queryByRole('columnheader', { name: 'Person' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Type' })).toBeInTheDocument();
    expect(bodyRows()[0]).toEqual(['12 Mar 2026 to 14 Mar 2026', 'Casual', 'Family wedding']);
  });

  it('has the Person column on the whole register', async () => {
    renderWithProviders(<LeaveTable />);
    expect(await screen.findByRole('columnheader', { name: 'Person' })).toBeInTheDocument();
  });

  it('adds a leave for that person without asking who, and says there is none yet when there are none', async () => {
    serve([]);
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<LeaveTable personId={3} />);
    expect(await screen.findByText('No leave recorded for this person yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add the first leave' }));
    expect(screen.queryByLabelText('Person')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Type'), 'Sick');
    await user.type(screen.getByLabelText('First day'), '2026-10-21');
    await user.type(screen.getByLabelText('Last day'), '2026-10-21');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith('/leaves', expect.objectContaining({ personId: 3, leaveType: 'sick' }))
    );
  });
});

describe('LeaveTable: adding, editing and deleting', () => {
  it('opens the dialog to add a leave', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LeaveTable />);
    await user.click(await screen.findByRole('button', { name: 'Add leave' }));
    expect(screen.getByRole('dialog', { name: 'New leave' })).toBeInTheDocument();
  });

  it('saves a new leave: the person, the type, both days and a null reason', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<LeaveTable />);
    await user.click(await screen.findByRole('button', { name: 'Add leave' }));
    await screen.findByRole('option', { name: 'Linus Torvalds' });
    await user.selectOptions(screen.getByLabelText('Person'), 'Linus Torvalds');
    await user.selectOptions(screen.getByLabelText('Type'), 'Earned');
    await user.type(screen.getByLabelText('First day'), '2026-11-02');
    await user.type(screen.getByLabelText('Last day'), '2026-11-06');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(coreApi.post).toHaveBeenCalledWith('/leaves', {
      personId: 3,
      startDate: '2026-11-02',
      endDate: '2026-11-06',
      leaveType: 'earned',
      reason: null,
    });
  });

  it('reads the register again after a save, so the new leave is in it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LeaveTable />);
    await user.click(await screen.findByRole('button', { name: 'Add leave' }));
    await screen.findByRole('option', { name: 'Linus Torvalds' });
    await user.selectOptions(screen.getByLabelText('Person'), 'Linus Torvalds');
    await user.selectOptions(screen.getByLabelText('Type'), 'Other');
    await user.type(screen.getByLabelText('First day'), '2026-11-02');
    await user.type(screen.getByLabelText('Last day'), '2026-11-02');
    const added = {
      ...leaveRows[0],
      id: 5,
      personId: 3,
      person: { id: 3, name: 'Linus Torvalds' },
      startDate: '2026-11-02',
      endDate: '2026-11-02',
      leaveType: 'other',
    };
    vi.mocked(coreApi.post).mockImplementation((async () => {
      serve([added, ...leaveRows]);
      return saved;
    }) as never);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((await rowOf('Linus Torvalds')).getByText('2 Nov 2026')).toBeInTheDocument();
  });

  it('opens the dialog on a leave to edit it, and changes it with PATCH', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<LeaveTable />);
    await user.click(await screen.findByRole('button', { name: 'Edit Ada Lovelace from 12 Mar 2026' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit leave' });
    expect(within(dialog).getByLabelText('Person')).toHaveValue('Ada Lovelace');
    expect(within(dialog).getByLabelText('Type')).toHaveValue('casual');
    expect(within(dialog).getByLabelText('First day')).toHaveValue('2026-03-12');
    expect(within(dialog).getByLabelText('Last day')).toHaveValue('2026-03-14');
    expect(within(dialog).getByLabelText('Reason')).toHaveValue('Family wedding');
    await user.clear(within(dialog).getByLabelText('Last day'));
    await user.type(within(dialog).getByLabelText('Last day'), '2026-03-15');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(coreApi.post).not.toHaveBeenCalled();
    expect(coreApi.patch).toHaveBeenCalledWith('/leaves/3', {
      startDate: '2026-03-12',
      endDate: '2026-03-15',
      leaveType: 'casual',
      reason: 'Family wedding',
    });
  });

  it('deletes a leave only after the confirmation, and says what it does', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<LeaveTable />);
    await user.click(await screen.findByRole('button', { name: 'Delete Ada Lovelace from 12 Mar 2026' }));
    expect(screen.getByText('Delete the leave of “Ada Lovelace”, 12 Mar 2026 to 14 Mar 2026?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(coreApi.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete leave' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/leaves/3'));
    expect(coreApi.delete).toHaveBeenCalledTimes(1);
  });

  it('names a leave of a single day by its one date in the confirmation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LeaveTable />);
    await user.click(await screen.findByRole('button', { name: 'Delete Grace Hopper from 21 Aug 2026' }));
    expect(screen.getByText('Delete the leave of “Grace Hopper”, 21 Aug 2026?')).toBeInTheDocument();
  });

  it('leaves the leave alone when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LeaveTable />);
    await user.click(await screen.findByRole('button', { name: 'Delete Ada Lovelace from 12 Mar 2026' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(coreApi.delete).not.toHaveBeenCalled();
    expect(bodyRows()).toHaveLength(4);
  });

  it('moves focus to the search field after a delete removes the row that held it', async () => {
    vi.mocked(coreApi.delete).mockImplementation((async () => {
      serve(leaveRows.filter((row) => row.id !== 3));
      return saved;
    }) as never);
    const user = userEvent.setup();
    renderWithProviders(<LeaveTable />);
    await user.click(await screen.findByRole('button', { name: 'Delete Ada Lovelace from 12 Mar 2026' }));
    await user.click(screen.getByRole('button', { name: 'Delete leave' }));
    await waitFor(() => expect(screen.getByLabelText('Search leave')).toHaveFocus());
  });
});

describe('LeaveTable: empty and failed', () => {
  it('offers to add the first leave when there is none', async () => {
    serve([]);
    const user = userEvent.setup();
    renderWithProviders(<LeaveTable />);
    expect(await screen.findByText('No leave recorded yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add the first leave' }));
    expect(screen.getByRole('dialog', { name: 'New leave' })).toBeInTheDocument();
  });

  it('shows an error with a retry when the leaves cannot be loaded, and loads them on the retry', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    renderWithProviders(<LeaveTable />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    serve();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table', { name: 'Leave' })).toBeInTheDocument();
  });

  it.each([
    ['a bare array, which is not the service’s envelope', leaveRows],
    ['a leave that has lost its person', leavesEnvelope([{ ...leaveRows[0], person: undefined }])],
  ])('shows the error state, not a broken table, when the service answers with %s', async (_label, body) => {
    vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
      if (path === '/leaves') return { data: body };
      return { data: peopleEnvelope() };
    }) as never);
    renderWithProviders(<LeaveTable />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
  });
});
