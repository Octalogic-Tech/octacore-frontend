import type { Announcements } from '@dnd-kit/core';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import type { ComponentProps } from 'react';
import { Kanban } from '@/components/ui/kanban';
import { coreApi } from '@/lib/core-api';
import { allocationEnvelope, allocationRows, allocationsEnvelope } from '@/test/fixtures/allocations';
import { peopleEnvelope, personRows } from '@/test/fixtures/people';
import { projectRows, projectsEnvelope } from '@/test/fixtures/projects';
import { renderWithProviders } from '@/test/utils';
import { AllocationBoard } from './allocation-board';
import type { BoardCard } from './board';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

// A fixed "today", so a move can be checked against its exact date.
vi.mock('@/lib/format', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/format')>()),
  localToday: () => '2026-10-20',
}));

// The real Kanban, with the props the board gave it kept, so a test can do what dnd-kit does when a card is dragged:
// jsdom has no layout, so a pointer or keyboard drag cannot find a column to drop on. Cypress covers a real drag.
type KanbanProps = ComponentProps<typeof Kanban<BoardCard>>;
let kanban: KanbanProps;
vi.mock('@/components/ui/kanban', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/kanban')>();
  return {
    ...actual,
    Kanban: (props: KanbanProps) => {
      kanban = props;
      return <actual.Kanban {...props} />;
    },
  };
});

const failure = (status: number) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, {
    status,
    data: {},
    statusText: String(status),
    headers: {},
    config: {} as never,
  });

// Ada (₹85,000.00) and Grace (₹1,15,000.00, back in the fixtures' clock) have salaries, Linus has none. Website and
// Mobile app are both active here. Ada is on Website from 12 Mar 2026, Grace on Mobile app from 5 Jan 2026, and Linus
// has no entry, so he is on the bench.
const ada = personRows[0];
const grace = { ...personRows[1], leaveDate: null, monthlySalaryPaise: 11_500_000 };
const linus = personRows[2];
const website = projectRows[0];
const mobileApp = { ...projectRows[1], projectStatus: 'active' };
const legacyPortal = projectRows[2];
const adaOnWebsite = allocationRows[1];
const graceOnMobile = allocationRows[2];

interface Data {
  people?: unknown[];
  projects?: unknown[];
  entries?: unknown[];
}

const state: Required<Data> = { people: [], projects: [], entries: [] };

/** What the service would answer now: `state` is what a test changes to say what a save did. */
const serve = (data: Data = {}) => {
  Object.assign(
    state,
    {
      people: [ada, grace, linus],
      projects: [website, mobileApp, legacyPortal],
      entries: [adaOnWebsite, graceOnMobile],
    },
    data
  );
  vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
    if (path === '/people') return { data: peopleEnvelope(state.people) };
    if (path === '/projects') return { data: projectsEnvelope(state.projects) };
    if (path === '/allocations') return { data: allocationsEnvelope(state.entries) };
    throw new Error(`unexpected GET ${path}`);
  }) as never);
};

/** What the service answers a move with; the board does not read it. */
const saved = { data: allocationEnvelope() };

/** A column, by its name. */
const column = (name: string) => within(screen.getByRole('group', { name }));
const cardOf = (name: string) => screen.getByRole('link', { name }).closest('li') as HTMLElement;
const moveSelect = (name: string) => screen.getByLabelText(`Move ${name} to`);
const namesIn = (name: string) =>
  column(name)
    .queryAllByRole('listitem')
    .map((item) => within(item).getByRole('link').textContent);

async function renderBoard() {
  const view = renderWithProviders(<AllocationBoard />);
  await screen.findByRole('heading', { level: 2, name: 'Bench' });
  return view;
}

beforeEach(() => {
  serve();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('AllocationBoard: the columns', () => {
  it('asks for the people, the projects and every entry', async () => {
    await renderBoard();
    expect(coreApi.get).toHaveBeenCalledWith('/people');
    expect(coreApi.get).toHaveBeenCalledWith('/projects');
    expect(coreApi.get).toHaveBeenCalledWith('/allocations', { params: undefined });
  });

  it('puts the Bench first, then the active projects by name, and none for a project that is not active', async () => {
    await renderBoard();
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'Bench',
      'Mobile app',
      'Website',
    ]);
    expect(screen.queryByText('Legacy portal')).not.toBeInTheDocument();
  });

  it('puts each person in the column of their project, and a person with no entry on the Bench', async () => {
    await renderBoard();
    expect(namesIn('Website')).toEqual(['Ada Lovelace']);
    expect(namesIn('Mobile app')).toEqual(['Grace Hopper']);
    expect(namesIn('Bench')).toEqual(['Linus Torvalds']);
  });

  it('links a project’s name to the project, and not the Bench', async () => {
    await renderBoard();
    expect(column('Website').getByRole('link', { name: 'Website' })).toHaveAttribute('href', '/projects/1');
    expect(column('Mobile app').getByRole('link', { name: 'Mobile app' })).toHaveAttribute('href', '/projects/2');
    expect(column('Bench').queryByRole('heading', { level: 2 })?.querySelector('a')).toBeNull();
  });

  it('shows a column’s head count and monthly cost in rupees', async () => {
    await renderBoard();
    expect(column('Website').getByText('1 person, ₹85,000.00 a month')).toBeInTheDocument();
    expect(column('Mobile app').getByText('1 person, ₹1,15,000.00 a month')).toBeInTheDocument();
  });

  it('adds up the people of a column in Indian grouping, and counts heads in the plural', async () => {
    serve({ entries: [adaOnWebsite, { ...graceOnMobile, projectId: 1, project: { id: 1, name: 'Website' } }] });
    await renderBoard();
    expect(column('Website').getByText('2 people, ₹2,00,000.00 a month')).toBeInTheDocument();
    expect(column('Mobile app').getByText('0 people, ₹0.00 a month')).toBeInTheDocument();
  });

  it('counts a person with no salary as nothing, and says how many have none, only where there is one', async () => {
    const mary = { ...linus, id: 4, name: 'Mary Seacole' };
    serve({ people: [ada, grace, linus, mary] });
    await renderBoard();
    expect(column('Bench').getByText('2 people, ₹0.00 a month')).toBeInTheDocument();
    expect(column('Bench').getByText('2 without a salary')).toBeInTheDocument();
    expect(column('Website').queryByText(/without a salary/)).not.toBeInTheDocument();
  });

  it('says it in the singular for one', async () => {
    await renderBoard();
    expect(column('Bench').getByText('1 without a salary')).toBeInTheDocument();
  });

  it('leaves out a person who has left, or has not joined yet', async () => {
    const gone = { ...grace, leaveDate: '2026-10-19' };
    const coming = { ...linus, joinDate: '2026-10-21' };
    serve({ people: [ada, gone, coming] });
    await renderBoard();
    expect(screen.queryByRole('link', { name: 'Grace Hopper' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Linus Torvalds' })).not.toBeInTheDocument();
    expect(namesIn('Website')).toEqual(['Ada Lovelace']);
  });

  it('keeps a column with nobody on it, and says so', async () => {
    serve({ entries: [adaOnWebsite] });
    await renderBoard();
    expect(column('Mobile app').getByText('Nobody is on this project.')).toBeInTheDocument();
    expect(column('Mobile app').queryAllByRole('listitem')).toHaveLength(0);
  });
});

describe('AllocationBoard: a card', () => {
  it('shows the name as a link to the person’s page, since the date of their entry, and their salary', async () => {
    await renderBoard();
    const card = within(cardOf('Ada Lovelace'));
    expect(card.getByRole('link', { name: 'Ada Lovelace' })).toHaveAttribute('href', '/resources/people/1');
    expect(card.getByText('since 12 Mar 2026')).toBeInTheDocument();
    expect(card.getByText('₹85,000.00')).toBeInTheDocument();
  });

  it('shows no salary for a person who has none', async () => {
    await renderBoard();
    expect(within(cardOf('Linus Torvalds')).queryByText(/₹/)).not.toBeInTheDocument();
  });

  it('shows no date for a person who has no entry yet', async () => {
    await renderBoard();
    expect(within(cardOf('Linus Torvalds')).queryByText(/since/)).not.toBeInTheDocument();
  });

  it('says since when for a person on the Bench by an entry', async () => {
    serve({ entries: [allocationRows[0]], people: [grace] });
    await renderBoard();
    expect(within(cardOf('Grace Hopper')).getByText('since 3 Aug 2026')).toBeInTheDocument();
  });

  it('shows the note, not a date, for a person whose last project is no longer active', async () => {
    serve({ projects: [website, projectRows[1], legacyPortal] });
    await renderBoard();
    const card = within(cardOf('Grace Hopper'));
    expect(card.getByText('Last on Mobile app (on hold)')).toBeInTheDocument();
    expect(card.queryByText(/since/)).not.toBeInTheDocument();
    expect(namesIn('Bench')).toContain('Grace Hopper');
  });

  it('has a handle to drag it by, named for the person', async () => {
    await renderBoard();
    expect(within(cardOf('Ada Lovelace')).getByRole('button', { name: 'Drag Ada Lovelace' })).toBeInTheDocument();
  });

  it('has a Move select that starts on a disabled placeholder and lists the columns in order', async () => {
    await renderBoard();
    const select = moveSelect('Ada Lovelace');
    const options = within(select).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Move to…', 'Bench', 'Mobile app', 'Website']);
    expect(options[0]).toBeDisabled();
    expect(select).toHaveValue('');
  });
});

describe('AllocationBoard: moving with the select', () => {
  it('saves a move to a project with today’s date, and shows the card there at once', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    await renderBoard();
    await user.selectOptions(moveSelect('Linus Torvalds'), 'Website');
    expect(coreApi.post).toHaveBeenCalledWith('/allocations/move', {
      personId: 3,
      projectId: 1,
      effectiveDate: '2026-10-20',
    });
    expect(namesIn('Website')).toEqual(['Ada Lovelace', 'Linus Torvalds']);
    expect(namesIn('Bench')).toEqual([]);
  });

  it('saves a move to the Bench with no project', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    await renderBoard();
    await user.selectOptions(moveSelect('Ada Lovelace'), 'Bench');
    expect(coreApi.post).toHaveBeenCalledWith('/allocations/move', {
      personId: 1,
      projectId: null,
      effectiveDate: '2026-10-20',
    });
    expect(namesIn('Bench')).toEqual(['Ada Lovelace', 'Linus Torvalds']);
  });

  it('saves nothing for the column the card is already in', async () => {
    const user = userEvent.setup();
    await renderBoard();
    await user.selectOptions(moveSelect('Ada Lovelace'), 'Website');
    await user.selectOptions(moveSelect('Linus Torvalds'), 'Bench');
    expect(coreApi.post).not.toHaveBeenCalled();
    expect(namesIn('Website')).toEqual(['Ada Lovelace']);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reads the entries again after a save, and the card is since today', async () => {
    vi.mocked(coreApi.post).mockImplementation((async () => {
      state.entries = [
        {
          ...adaOnWebsite,
          id: 9,
          personId: 3,
          projectId: 1,
          effectiveDate: '2026-10-20',
          person: { id: 3, name: 'Linus Torvalds' },
        },
        ...state.entries,
      ];
      return saved;
    }) as never);
    const user = userEvent.setup();
    await renderBoard();
    await user.selectOptions(moveSelect('Linus Torvalds'), 'Website');
    await waitFor(() => expect(within(cardOf('Linus Torvalds')).getByText('since 20 Oct 2026')).toBeInTheDocument());
    expect(namesIn('Website')).toEqual(['Ada Lovelace', 'Linus Torvalds']);
    expect(column('Website').getByText('2 people, ₹85,000.00 a month')).toBeInTheDocument();
  });

  it('keeps focus on the card’s select, which is in its new column', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    await renderBoard();
    await user.selectOptions(moveSelect('Linus Torvalds'), 'Website');
    await waitFor(() => expect(moveSelect('Linus Torvalds')).toHaveFocus());
    expect(column('Website').getByLabelText('Move Linus Torvalds to')).toBe(moveSelect('Linus Torvalds'));
  });

  it('puts the card back, says so, and keeps focus on its select when the save fails', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(failure(500));
    const user = userEvent.setup();
    await renderBoard();
    await user.selectOptions(moveSelect('Linus Torvalds'), 'Website');
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save. The card is back where it was.');
    expect(namesIn('Bench')).toEqual(['Linus Torvalds']);
    expect(namesIn('Website')).toEqual(['Ada Lovelace']);
    expect(column('Bench').getByText('1 without a salary')).toBeInTheDocument();
    await waitFor(() => expect(moveSelect('Linus Torvalds')).toHaveFocus());
  });

  it('clears the message when the next move is tried', async () => {
    vi.mocked(coreApi.post).mockRejectedValueOnce(failure(500)).mockResolvedValue(saved);
    const user = userEvent.setup();
    await renderBoard();
    await user.selectOptions(moveSelect('Linus Torvalds'), 'Website');
    await screen.findByRole('alert');
    await user.selectOptions(moveSelect('Linus Torvalds'), 'Mobile app');
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(namesIn('Mobile app')).toEqual(['Grace Hopper', 'Linus Torvalds']);
  });
});

describe('AllocationBoard: dragging', () => {
  /** What the Kanban hands over while a card is over another column: the card taken out and put at the end of it. */
  const carry = (key: string, to: string) => {
    const next: Record<string, BoardCard[]> = {};
    let card: BoardCard | undefined;
    for (const [columnKey, cards] of Object.entries(kanban.value)) {
      card = card ?? cards.find((candidate) => candidate.key === key);
      next[columnKey] = cards.filter((candidate) => candidate.key !== key);
    }
    next[to] = [...(next[to] ?? []), card as BoardCard];
    return next;
  };

  const dropEvent = (active: string, over: string | null) =>
    ({ active: { id: active }, over: over === null ? null : { id: over } } as never);

  it('uses prefixed keys, so a card’s id cannot be a column’s', async () => {
    await renderBoard();
    expect(Object.keys(kanban.value)).toEqual(['col-bench', 'col-2', 'col-1']);
    expect(Object.values(kanban.value).flatMap((cards) => cards.map((card) => card.key))).toEqual([
      'person-3',
      'person-2',
      'person-1',
    ]);
  });

  it('moves a card to the column it is over, and saves it where it is dropped', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    await renderBoard();
    act(() => kanban.onValueChange?.(carry('person-3', 'col-1')));
    expect(namesIn('Website')).toEqual(['Ada Lovelace', 'Linus Torvalds']);
    expect(coreApi.post).not.toHaveBeenCalled();
    act(() => kanban.onDragEnd?.(dropEvent('person-3', 'person-1')));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith('/allocations/move', {
        personId: 3,
        projectId: 1,
        effectiveDate: '2026-10-20',
      })
    );
    expect(coreApi.post).toHaveBeenCalledTimes(1);
  });

  it('saves a drop on the Bench with no project', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    await renderBoard();
    act(() => kanban.onValueChange?.(carry('person-1', 'col-bench')));
    act(() => kanban.onDragEnd?.(dropEvent('person-1', 'col-bench')));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith('/allocations/move', {
        personId: 1,
        projectId: null,
        effectiveDate: '2026-10-20',
      })
    );
  });

  it('saves nothing for a card dropped back on the column it came from', async () => {
    await renderBoard();
    act(() => kanban.onValueChange?.(carry('person-3', 'col-1')));
    act(() => kanban.onValueChange?.(carry('person-3', 'col-bench')));
    act(() => kanban.onDragEnd?.(dropEvent('person-3', 'person-3')));
    expect(coreApi.post).not.toHaveBeenCalled();
    expect(namesIn('Bench')).toEqual(['Linus Torvalds']);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ignores a card reordered inside its column: cards stay sorted by name, and nothing is saved', async () => {
    serve({
      entries: [adaOnWebsite, { ...allocationRows[2], personId: 2, projectId: 1, project: { id: 1, name: 'Website' } }],
    });
    await renderBoard();
    expect(namesIn('Website')).toEqual(['Ada Lovelace', 'Grace Hopper']);
    const website = kanban.value['col-1'];
    act(() => kanban.onValueChange?.({ ...kanban.value, 'col-1': [...website].reverse() }));
    expect(namesIn('Website')).toEqual(['Ada Lovelace', 'Grace Hopper']);
    act(() => kanban.onDragEnd?.(dropEvent('person-1', 'person-2')));
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('puts the card back when the drag is cancelled', async () => {
    await renderBoard();
    act(() => kanban.onValueChange?.(carry('person-3', 'col-1')));
    expect(namesIn('Bench')).toEqual([]);
    act(() => kanban.onDragCancel?.({ active: { id: 'person-3' }, over: null } as never));
    expect(namesIn('Bench')).toEqual(['Linus Torvalds']);
    expect(namesIn('Website')).toEqual(['Ada Lovelace']);
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('puts the card back, and saves nothing, when it is dropped on nothing', async () => {
    await renderBoard();
    act(() => kanban.onValueChange?.(carry('person-3', 'col-1')));
    act(() => kanban.onDragEnd?.(dropEvent('person-3', null)));
    expect(namesIn('Bench')).toEqual(['Linus Torvalds']);
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('puts the card back and says so when a drop does not save', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(failure(409));
    await renderBoard();
    act(() => kanban.onValueChange?.(carry('person-3', 'col-1')));
    act(() => kanban.onDragEnd?.(dropEvent('person-3', 'col-1')));
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save. The card is back where it was.');
    expect(namesIn('Bench')).toEqual(['Linus Torvalds']);
    expect(namesIn('Website')).toEqual(['Ada Lovelace']);
  });

  it('moves the head count and the cost with the card while it is over another column', async () => {
    await renderBoard();
    act(() => kanban.onValueChange?.(carry('person-3', 'col-1')));
    expect(column('Website').getByText('2 people, ₹85,000.00 a month')).toBeInTheDocument();
    expect(column('Website').getByText('1 without a salary')).toBeInTheDocument();
    expect(column('Bench').getByText('0 people, ₹0.00 a month')).toBeInTheDocument();
    expect(column('Bench').queryByText(/without a salary/)).not.toBeInTheDocument();
  });

  it('lists a card among its new column’s by name once it is moved', async () => {
    serve({
      entries: [
        { ...adaOnWebsite, personId: 1 },
        { ...graceOnMobile, personId: 2, projectId: 1, project: { id: 1, name: 'Website' } },
      ],
    });
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    await renderBoard();
    await user.selectOptions(moveSelect('Linus Torvalds'), 'Website');
    expect(namesIn('Website')).toEqual(['Ada Lovelace', 'Grace Hopper', 'Linus Torvalds']);
    await user.selectOptions(moveSelect('Grace Hopper'), 'Bench');
    expect(namesIn('Bench')).toEqual(['Grace Hopper']);
  });

  it('follows the data when it changes under it', async () => {
    const { client } = await renderBoard();
    serve({
      entries: [
        adaOnWebsite,
        graceOnMobile,
        {
          ...adaOnWebsite,
          id: 9,
          personId: 3,
          projectId: 2,
          person: { id: 3, name: 'Linus Torvalds' },
          project: { id: 2, name: 'Mobile app' },
        },
      ],
    });
    await act(() => client.invalidateQueries({ queryKey: ['allocations'] }));
    await waitFor(() => expect(namesIn('Mobile app')).toEqual(['Grace Hopper', 'Linus Torvalds']));
    expect(namesIn('Bench')).toEqual([]);
  });
});

describe('AllocationBoard: its states', () => {
  it.each([
    ['people', '/people'],
    ['projects', '/projects'],
    ['entries', '/allocations'],
  ])('says it could not load, and tries again, when the %s fail', async (_what, path) => {
    const user = userEvent.setup();
    vi.mocked(coreApi.get).mockImplementation((async (requested: string) => {
      if (requested === path) throw failure(500);
      if (requested === '/people') return { data: peopleEnvelope() };
      if (requested === '/projects') return { data: projectsEnvelope() };
      return { data: allocationsEnvelope() };
    }) as never);
    renderWithProviders(<AllocationBoard />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We could not load this data');
    serve();
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Bench' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says there is nobody to put on the board, and where to add people, when there are no people', async () => {
    serve({ people: [] });
    renderWithProviders(<AllocationBoard />);
    expect(await screen.findByText('There are no people to put on the board yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add people' })).toHaveAttribute('href', '/resources/people');
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });

  it('shows loading rows while it waits', () => {
    vi.mocked(coreApi.get).mockReturnValue(new Promise(() => undefined) as never);
    renderWithProviders(<AllocationBoard />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });
});

describe('AllocationBoard: what a screen reader is told while dragging', () => {
  const announce = () => (kanban.accessibility?.announcements ?? {}) as Required<Announcements>;
  const args = (active: string, over: string | null) =>
    ({ active: { id: active }, over: over === null ? null : { id: over } } as never);

  it('names the person and the column, not positions and column keys', async () => {
    await renderBoard();
    expect(announce().onDragStart(args('person-1', null))).toBe('Picked up Ada Lovelace, from Website.');
    expect(announce().onDragOver(args('person-1', 'col-bench'))).toBe('Ada Lovelace is over Bench.');
    expect(announce().onDragOver(args('person-1', 'person-2'))).toBe('Ada Lovelace is over Mobile app.');
    expect(announce().onDragOver(args('person-1', null))).toBeUndefined();
    expect(announce().onDragEnd(args('person-1', 'col-2'))).toBe('Ada Lovelace was dropped on Mobile app.');
    expect(announce().onDragEnd(args('person-1', null))).toBe('Ada Lovelace was not dropped on a column.');
    expect(announce().onDragCancel(args('person-1', null))).toBe(
      'Dragging was cancelled. Ada Lovelace is back on Website.'
    );
  });

  it('says where a card is now, which is the column it was carried to', async () => {
    await renderBoard();
    act(() =>
      kanban.onValueChange?.({
        ...kanban.value,
        'col-bench': [],
        'col-1': [...kanban.value['col-1'], kanban.value['col-bench'][0]],
      })
    );
    expect(announce().onDragOver(args('person-3', 'person-3'))).toBe('Linus Torvalds is over Website.');
  });

  it('tells how to move a card by keyboard, and that the menu does it too', async () => {
    await renderBoard();
    expect(kanban.accessibility?.screenReaderInstructions?.draggable).toMatch(/pick up a card, press space or enter/);
    expect(kanban.accessibility?.screenReaderInstructions?.draggable).toMatch(/Move to menu/);
  });
});
