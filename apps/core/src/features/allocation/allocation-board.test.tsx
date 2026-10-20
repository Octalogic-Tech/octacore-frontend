import type { Announcements } from '@dnd-kit/core';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import type { ComponentProps } from 'react';
import { FullMainContext } from '@/components/full-main';
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

const failure = (status: number, message?: string) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, {
    status,
    data: message ? { statusCode: status, message, data: null } : {},
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
/** The button at a card's top right that opens its menu. */
const actions = (name: string) => screen.getByRole('button', { name: `Actions for ${name}` });
/** Moves a card with its menu: opens it and picks the column. */
async function moveVia(user: ReturnType<typeof userEvent.setup>, name: string, to: string) {
  await user.click(actions(name));
  await user.click(await screen.findByRole('menuitem', { name: to }));
}
/** A column head, whose figures are in spans of their own: the text of the paragraph as a whole. */
const headline = (text: string) => (_: string, element: Element | null) =>
  element?.tagName === 'P' && element.textContent === text;
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

  it('shows a column’s card count and monthly cost in rupees', async () => {
    await renderBoard();
    expect(column('Website').getByText(headline('1 card, ₹85,000.00 a month'))).toBeInTheDocument();
    expect(column('Mobile app').getByText(headline('1 card, ₹1,15,000.00 a month'))).toBeInTheDocument();
  });

  it('sets only the count of a head in tabular numerals: the cost, which the font would draw with wide punctuation, is not', async () => {
    await renderBoard();
    const head = column('Website').getByText(headline('1 card, ₹85,000.00 a month'));
    expect(head).not.toHaveClass('tabular');
    expect([...head.querySelectorAll('.tabular')].map((figure) => figure.textContent)).toEqual(['1']);
  });

  it('does not set the salary on a card in tabular numerals either', async () => {
    await renderBoard();
    expect(within(cardOf('Ada Lovelace')).getByText('₹85,000.00')).not.toHaveClass('tabular');
  });

  it('adds up the cards of a column in Indian grouping, and counts cards in the plural', async () => {
    serve({ entries: [adaOnWebsite, { ...graceOnMobile, projectId: 1, project: { id: 1, name: 'Website' } }] });
    await renderBoard();
    expect(column('Website').getByText(headline('2 cards, ₹2,00,000.00 a month'))).toBeInTheDocument();
    expect(column('Mobile app').getByText(headline('0 cards, ₹0.00 a month'))).toBeInTheDocument();
  });

  it('counts a person with no salary as nothing, and says how many have none, only where there is one', async () => {
    const mary = { ...linus, id: 4, name: 'Mary Seacole' };
    serve({ people: [ada, grace, linus, mary] });
    await renderBoard();
    expect(column('Bench').getByText(headline('2 cards, ₹0.00 a month'))).toBeInTheDocument();
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
  it('shows the name as a link to the person’s page, and their salary', async () => {
    await renderBoard();
    const card = within(cardOf('Ada Lovelace'));
    expect(card.getByRole('link', { name: 'Ada Lovelace' })).toHaveAttribute('href', '/resources/people/1');
    expect(card.getByText('₹85,000.00')).toBeInTheDocument();
  });

  it('shows no date on any card: the ledger holds those', async () => {
    serve({ entries: [adaOnWebsite, graceOnMobile, allocationRows[0]] });
    await renderBoard();
    expect(screen.queryByText(/since/)).not.toBeInTheDocument();
    expect(screen.queryByText(/12 Mar 2026|5 Jan 2026|3 Aug 2026/)).not.toBeInTheDocument();
  });

  it('shows no salary for a person who has none', async () => {
    await renderBoard();
    expect(within(cardOf('Linus Torvalds')).queryByText(/₹/)).not.toBeInTheDocument();
  });

  it('shows nothing under the name of a person with no note and no salary', async () => {
    await renderBoard();
    const card = cardOf('Linus Torvalds');
    expect(within(card).getAllByRole('link')).toHaveLength(1);
    expect(card.querySelectorAll('p')).toHaveLength(0);
  });

  it('shows the note for a person whose last project is no longer active', async () => {
    serve({ projects: [website, projectRows[1], legacyPortal] });
    await renderBoard();
    const card = within(cardOf('Grace Hopper'));
    expect(card.getByText('Last on Mobile app (on hold)')).toBeInTheDocument();
    expect(namesIn('Bench')).toContain('Grace Hopper');
  });

  it('is itself what is dragged: a draggable card with no handle of its own', async () => {
    await renderBoard();
    const card = cardOf('Ada Lovelace');
    expect(card).toHaveAttribute('aria-roledescription', 'draggable card');
    expect(card).toHaveAttribute('aria-label', 'Ada Lovelace');
    expect(card).toHaveAttribute('tabindex', '0');
    expect(card).toHaveClass('cursor-grab');
    expect(card).not.toHaveClass('touch-none');
    expect(screen.queryByRole('button', { name: /^Drag / })).not.toBeInTheDocument();
  });

  it('is not a button, which would hold a link and a button', async () => {
    await renderBoard();
    expect(cardOf('Ada Lovelace')).not.toHaveAttribute('role', 'button');
    expect(within(cardOf('Ada Lovelace')).getByRole('link', { name: 'Ada Lovelace' })).toBeInTheDocument();
  });

  it('has an Actions button at its top right, named for the person, and no Move select', async () => {
    await renderBoard();
    expect(within(cardOf('Ada Lovelace')).getByRole('button', { name: 'Actions for Ada Lovelace' })).toHaveClass(
      'size-11'
    );
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Move .* to$/)).not.toBeInTheDocument();
  });
});

describe('AllocationBoard: a card’s menu', () => {
  it('opens on the button, with a Move to group of one item for each other column: the bench first, then the projects', async () => {
    const user = userEvent.setup();
    await renderBoard();
    await user.click(actions('Linus Torvalds'));
    const menu = await screen.findByRole('menu', { name: 'Actions for Linus Torvalds' });
    expect(within(menu).getByText('Move to')).toBeInTheDocument();
    expect(
      within(within(menu).getByRole('group', { name: 'Move to' }))
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['Mobile app', 'Website']);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await user.click(actions('Ada Lovelace'));
    const other = await screen.findByRole('menu', { name: 'Actions for Ada Lovelace' });
    expect(
      within(within(other).getByRole('group', { name: 'Move to' }))
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['Bench', 'Mobile app']);
  });

  it('makes every item a 44px target', async () => {
    const user = userEvent.setup();
    await renderBoard();
    await user.click(actions('Linus Torvalds'));
    for (const item of await screen.findAllByRole('menuitem')) expect(item).toHaveClass('min-h-11');
  });

  it('does not start a drag, or follow the link, when the button is pressed', async () => {
    const user = userEvent.setup();
    await renderBoard();
    await user.click(actions('Linus Torvalds'));
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('Picked up');
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('opens from the keyboard with Enter, Space or the down arrow, moves with the arrows, and picks with Enter', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    await renderBoard();
    for (const key of ['{Enter}', ' ', '{ArrowDown}']) {
      actions('Linus Torvalds').focus();
      await user.keyboard(key);
      expect(await screen.findByRole('menu')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      await waitFor(() => expect(actions('Linus Torvalds')).toHaveFocus());
    }
    await user.keyboard('{Enter}');
    await screen.findByRole('menu');
    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith('/allocations/move', {
        personId: 3,
        card: 1,
        projectId: 1,
        effectiveDate: '2026-10-20',
      })
    );
  });

  it('is not a drag when Enter is pressed on the card’s link: the key follows the link', async () => {
    const user = userEvent.setup();
    await renderBoard();
    screen.getByRole('link', { name: 'Ada Lovelace' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.queryByText('Picked up Ada Lovelace, from Website.')).not.toBeInTheDocument();
  });
});

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

/** A promise the test settles by hand, to hold a save in flight. */
function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('AllocationBoard: moving with the select', () => {
  it('saves a move to a project with today’s date, and shows the card there at once', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    await renderBoard();
    await moveVia(user, 'Linus Torvalds', 'Website');
    expect(coreApi.post).toHaveBeenCalledWith('/allocations/move', {
      personId: 3,
      card: 1,
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
    await moveVia(user, 'Ada Lovelace', 'Bench');
    expect(coreApi.post).toHaveBeenCalledWith('/allocations/move', {
      personId: 1,
      card: 1,
      projectId: null,
      effectiveDate: '2026-10-20',
    });
    expect(namesIn('Bench')).toEqual(['Ada Lovelace', 'Linus Torvalds']);
  });

  it('does not offer the column the card is in, so a move to it cannot be asked for', async () => {
    const user = userEvent.setup();
    await renderBoard();
    await user.click(actions('Ada Lovelace'));
    expect(screen.queryByRole('menuitem', { name: 'Website' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(coreApi.post).not.toHaveBeenCalled();
    expect(namesIn('Website')).toEqual(['Ada Lovelace']);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reads the entries again after a save, and the head follows', async () => {
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
    await moveVia(user, 'Linus Torvalds', 'Website');
    await waitFor(() =>
      expect(vi.mocked(coreApi.get).mock.calls.filter(([path]) => path === '/allocations')).toHaveLength(2)
    );
    expect(namesIn('Website')).toEqual(['Ada Lovelace', 'Linus Torvalds']);
    expect(column('Website').getByText(headline('2 cards, ₹85,000.00 a month'))).toBeInTheDocument();
  });

  it('keeps focus on the card’s Actions button, which is in its new column', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    await renderBoard();
    await moveVia(user, 'Linus Torvalds', 'Website');
    await waitFor(() => expect(actions('Linus Torvalds')).toHaveFocus());
    expect(column('Website').getByRole('button', { name: 'Actions for Linus Torvalds' })).toBe(
      actions('Linus Torvalds')
    );
  });

  it('puts the card back, says so, and keeps focus on its Actions button when the save fails', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(failure(500));
    const user = userEvent.setup();
    await renderBoard();
    await moveVia(user, 'Linus Torvalds', 'Website');
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save. The card is back where it was.');
    expect(namesIn('Bench')).toEqual(['Linus Torvalds']);
    expect(namesIn('Website')).toEqual(['Ada Lovelace']);
    expect(column('Bench').getByText('1 without a salary')).toBeInTheDocument();
    await waitFor(() => expect(actions('Linus Torvalds')).toHaveFocus());
  });

  it('clears the message when the next move is tried', async () => {
    vi.mocked(coreApi.post).mockRejectedValueOnce(failure(500)).mockResolvedValue(saved);
    const user = userEvent.setup();
    await renderBoard();
    await moveVia(user, 'Linus Torvalds', 'Website');
    await screen.findByRole('alert');
    await moveVia(user, 'Linus Torvalds', 'Mobile app');
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(namesIn('Mobile app')).toEqual(['Grace Hopper', 'Linus Torvalds']);
  });
});

describe('AllocationBoard: dragging', () => {
  it('uses prefixed keys, so a card’s id cannot be a column’s', async () => {
    await renderBoard();
    expect(Object.keys(kanban.value)).toEqual(['col-bench', 'col-2', 'col-1']);
    expect(Object.values(kanban.value).flatMap((cards) => cards.map((card) => card.key))).toEqual([
      'person-3-card-1',
      'person-2-card-1',
      'person-1-card-1',
    ]);
  });

  it('moves a card to the column it is over, and saves it where it is dropped', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    await renderBoard();
    act(() => kanban.onValueChange?.(carry('person-3-card-1', 'col-1')));
    expect(namesIn('Website')).toEqual(['Ada Lovelace', 'Linus Torvalds']);
    expect(coreApi.post).not.toHaveBeenCalled();
    act(() => kanban.onDragEnd?.(dropEvent('person-3-card-1', 'person-1-card-1')));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith('/allocations/move', {
        personId: 3,
        card: 1,
        projectId: 1,
        effectiveDate: '2026-10-20',
      })
    );
    expect(coreApi.post).toHaveBeenCalledTimes(1);
  });

  it('saves a drop on the Bench with no project', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    await renderBoard();
    act(() => kanban.onValueChange?.(carry('person-1-card-1', 'col-bench')));
    act(() => kanban.onDragEnd?.(dropEvent('person-1-card-1', 'col-bench')));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith('/allocations/move', {
        personId: 1,
        card: 1,
        projectId: null,
        effectiveDate: '2026-10-20',
      })
    );
  });

  it('saves nothing for a card dropped back on the column it came from', async () => {
    await renderBoard();
    act(() => kanban.onValueChange?.(carry('person-3-card-1', 'col-1')));
    act(() => kanban.onValueChange?.(carry('person-3-card-1', 'col-bench')));
    act(() => kanban.onDragEnd?.(dropEvent('person-3-card-1', 'person-3-card-1')));
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
    act(() => kanban.onDragEnd?.(dropEvent('person-1-card-1', 'person-2-card-1')));
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('puts the card back when the drag is cancelled', async () => {
    await renderBoard();
    act(() => kanban.onValueChange?.(carry('person-3-card-1', 'col-1')));
    expect(namesIn('Bench')).toEqual([]);
    act(() => kanban.onDragCancel?.({ active: { id: 'person-3-card-1' }, over: null } as never));
    expect(namesIn('Bench')).toEqual(['Linus Torvalds']);
    expect(namesIn('Website')).toEqual(['Ada Lovelace']);
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('puts the card back, and saves nothing, when it is dropped on nothing', async () => {
    await renderBoard();
    act(() => kanban.onValueChange?.(carry('person-3-card-1', 'col-1')));
    act(() => kanban.onDragEnd?.(dropEvent('person-3-card-1', null)));
    expect(namesIn('Bench')).toEqual(['Linus Torvalds']);
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('puts the card back and says so when a drop does not save', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(failure(409));
    await renderBoard();
    act(() => kanban.onValueChange?.(carry('person-3-card-1', 'col-1')));
    act(() => kanban.onDragEnd?.(dropEvent('person-3-card-1', 'col-1')));
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save. The card is back where it was.');
    expect(namesIn('Bench')).toEqual(['Linus Torvalds']);
    expect(namesIn('Website')).toEqual(['Ada Lovelace']);
  });

  it('moves the card count and the cost with the card while it is over another column', async () => {
    await renderBoard();
    act(() => kanban.onValueChange?.(carry('person-3-card-1', 'col-1')));
    expect(column('Website').getByText(headline('2 cards, ₹85,000.00 a month'))).toBeInTheDocument();
    expect(column('Website').getByText('1 without a salary')).toBeInTheDocument();
    expect(column('Bench').getByText(headline('0 cards, ₹0.00 a month'))).toBeInTheDocument();
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
    await moveVia(user, 'Linus Torvalds', 'Website');
    expect(namesIn('Website')).toEqual(['Ada Lovelace', 'Grace Hopper', 'Linus Torvalds']);
    await moveVia(user, 'Grace Hopper', 'Bench');
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

describe('AllocationBoard: saves in flight', () => {
  const graceOnWebsite = { ...graceOnMobile, projectId: 1, project: { id: 1, name: 'Website' } };

  it('locks a card while its move is being saved: it cannot be dragged or moved from its menu a second time', async () => {
    const first = deferred();
    vi.mocked(coreApi.post).mockImplementation(() => first.promise as never);
    const user = userEvent.setup();
    await renderBoard();
    await moveVia(user, 'Linus Torvalds', 'Website');
    expect(actions('Linus Torvalds')).toBeDisabled();
    expect(cardOf('Linus Torvalds')).toHaveAttribute('data-disabled', 'true');
    expect(cardOf('Linus Torvalds')).not.toHaveAttribute('tabindex');
    // The other cards are free.
    expect(actions('Ada Lovelace')).toBeEnabled();
    expect(cardOf('Ada Lovelace')).toHaveAttribute('tabindex', '0');
    // A stray drop of the locked card changes nothing and sends nothing.
    act(() => kanban.onDragEnd?.(dropEvent('person-3-card-1', 'col-bench')));
    expect(coreApi.post).toHaveBeenCalledTimes(1);
    expect(namesIn('Website')).toEqual(['Ada Lovelace', 'Linus Torvalds']);
    first.resolve(saved);
    await waitFor(() => expect(actions('Linus Torvalds')).toBeEnabled());
    expect(cardOf('Linus Torvalds')).toHaveAttribute('tabindex', '0');
  });

  it('unlocks the card, and puts it back, when its save fails', async () => {
    const first = deferred();
    vi.mocked(coreApi.post).mockImplementation(() => first.promise as never);
    const user = userEvent.setup();
    await renderBoard();
    await moveVia(user, 'Linus Torvalds', 'Website');
    first.reject(failure(500));
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save');
    expect(actions('Linus Torvalds')).toBeEnabled();
    expect(namesIn('Bench')).toEqual(['Linus Torvalds']);
  });

  it('offers the columns other than the one the card shows in now: back to where it was is a move', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    await renderBoard();
    await moveVia(user, 'Linus Torvalds', 'Website');
    await waitFor(() => expect(actions('Linus Torvalds')).toBeEnabled());
    // The stand-in service has not changed, so the entries read back still say Bench; the card shows Website, so its
    // menu offers the Bench and not Website.
    await user.click(actions('Linus Torvalds'));
    expect(screen.queryByRole('menuitem', { name: 'Website' })).not.toBeInTheDocument();
    expect(await screen.findByRole('menuitem', { name: 'Bench' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(coreApi.post).toHaveBeenCalledTimes(1);
    await moveVia(user, 'Linus Torvalds', 'Bench');
    expect(coreApi.post).toHaveBeenCalledTimes(2);
    expect(coreApi.post).toHaveBeenLastCalledWith('/allocations/move', {
      personId: 3,
      card: 1,
      projectId: null,
      effectiveDate: '2026-10-20',
    });
    expect(namesIn('Bench')).toEqual(['Linus Torvalds']);
  });

  it('puts back only the card whose save failed, and leaves the move of another that is still saving', async () => {
    const first = deferred();
    vi.mocked(coreApi.post)
      .mockImplementationOnce(() => first.promise as never)
      .mockRejectedValueOnce(failure(500));
    const user = userEvent.setup();
    await renderBoard();
    await moveVia(user, 'Linus Torvalds', 'Mobile app');
    await moveVia(user, 'Ada Lovelace', 'Bench');
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save. The card is back where it was.');
    expect(namesIn('Website')).toEqual(['Ada Lovelace']);
    expect(namesIn('Mobile app')).toEqual(['Grace Hopper', 'Linus Torvalds']);
    expect(namesIn('Bench')).toEqual([]);
    expect(actions('Linus Torvalds')).toBeDisabled();
    expect(actions('Ada Lovelace')).toBeEnabled();
    state.entries = [
      {
        ...adaOnWebsite,
        id: 9,
        personId: 3,
        projectId: 2,
        person: { id: 3, name: 'Linus Torvalds' },
        project: { id: 2, name: 'Mobile app' },
      },
      adaOnWebsite,
      graceOnMobile,
    ];
    first.resolve(saved);
    await waitFor(() => expect(actions('Linus Torvalds')).toBeEnabled());
    expect(namesIn('Mobile app')).toEqual(['Grace Hopper', 'Linus Torvalds']);
    expect(namesIn('Website')).toEqual(['Ada Lovelace']);
  });

  it('does not move a card back when the entries are read again while its save is pending', async () => {
    const first = deferred();
    vi.mocked(coreApi.post).mockImplementation(() => first.promise as never);
    const user = userEvent.setup();
    const { client } = await renderBoard();
    await moveVia(user, 'Linus Torvalds', 'Website');
    // Someone else puts Grace on Website; the board reads the entries again while Linus's save is still on its way.
    serve({ entries: [adaOnWebsite, graceOnWebsite] });
    await act(() => client.invalidateQueries({ queryKey: ['allocations'] }));
    await waitFor(() => expect(namesIn('Website')).toEqual(['Ada Lovelace', 'Grace Hopper', 'Linus Torvalds']));
    expect(namesIn('Mobile app')).toEqual([]);
    expect(namesIn('Bench')).toEqual([]);
    expect(column('Website').getByText(headline('3 cards, ₹2,00,000.00 a month'))).toBeInTheDocument();
    first.resolve(saved);
    await waitFor(() => expect(actions('Linus Torvalds')).toBeEnabled());
    expect(namesIn('Website')).toEqual(['Ada Lovelace', 'Grace Hopper', 'Linus Torvalds']);
  });

  it('follows the entries for the cards that are not saving, when they are read again', async () => {
    const first = deferred();
    vi.mocked(coreApi.post).mockImplementation(() => first.promise as never);
    const user = userEvent.setup();
    const { client } = await renderBoard();
    await moveVia(user, 'Linus Torvalds', 'Website');
    serve({ entries: [adaOnWebsite, graceOnWebsite] });
    await act(() => client.invalidateQueries({ queryKey: ['allocations'] }));
    await waitFor(() => expect(namesIn('Mobile app')).toEqual([]));
    first.resolve(saved);
    await waitFor(() => expect(actions('Linus Torvalds')).toBeEnabled());
  });

  it('forgets a card that is saving when it is gone from the people when they are read again', async () => {
    const first = deferred();
    vi.mocked(coreApi.post).mockImplementation(() => first.promise as never);
    const user = userEvent.setup();
    const { client } = await renderBoard();
    await moveVia(user, 'Linus Torvalds', 'Website');
    serve({ people: [ada, grace] });
    await act(() => client.invalidateQueries({ queryKey: ['people'] }));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Linus Torvalds' })).not.toBeInTheDocument());
    first.resolve(saved);
    await waitFor(() => expect(namesIn('Website')).toEqual(['Ada Lovelace']));
  });

  it('puts back only the dragged card when a drag is cancelled, not a card that is saving', async () => {
    const first = deferred();
    vi.mocked(coreApi.post).mockImplementation(() => first.promise as never);
    const user = userEvent.setup();
    await renderBoard();
    await moveVia(user, 'Linus Torvalds', 'Website');
    act(() => kanban.onDragStart?.({ active: { id: 'person-1-card-1' } } as never));
    act(() => kanban.onValueChange?.(carry('person-1-card-1', 'col-bench')));
    expect(namesIn('Bench')).toEqual(['Ada Lovelace']);
    act(() => kanban.onDragCancel?.({ active: { id: 'person-1-card-1' }, over: null } as never));
    expect(namesIn('Website')).toEqual(['Ada Lovelace', 'Linus Torvalds']);
    expect(namesIn('Bench')).toEqual([]);
    first.resolve(saved);
    await waitFor(() => expect(actions('Linus Torvalds')).toBeEnabled());
  });

  it('puts back only the dragged card when it is dropped on its own column or on nothing, not a card that is saving', async () => {
    const first = deferred();
    vi.mocked(coreApi.post).mockImplementation(() => first.promise as never);
    const user = userEvent.setup();
    await renderBoard();
    await moveVia(user, 'Linus Torvalds', 'Website');
    act(() => kanban.onDragStart?.({ active: { id: 'person-1-card-1' } } as never));
    act(() => kanban.onValueChange?.(carry('person-1-card-1', 'col-bench')));
    act(() => kanban.onValueChange?.(carry('person-1-card-1', 'col-1')));
    act(() => kanban.onDragEnd?.(dropEvent('person-1-card-1', 'person-1-card-1')));
    expect(namesIn('Website')).toEqual(['Ada Lovelace', 'Linus Torvalds']);
    act(() => kanban.onDragStart?.({ active: { id: 'person-1-card-1' } } as never));
    act(() => kanban.onValueChange?.(carry('person-1-card-1', 'col-bench')));
    act(() => kanban.onDragEnd?.(dropEvent('person-1-card-1', null)));
    expect(namesIn('Website')).toEqual(['Ada Lovelace', 'Linus Torvalds']);
    expect(namesIn('Bench')).toEqual([]);
    expect(coreApi.post).toHaveBeenCalledTimes(1);
    first.resolve(saved);
    await waitFor(() => expect(actions('Linus Torvalds')).toBeEnabled());
  });

  it('saves a drag that starts from where the card was and ends elsewhere, with the drag start known', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    await renderBoard();
    act(() => kanban.onDragStart?.({ active: { id: 'person-3-card-1' } } as never));
    act(() => kanban.onValueChange?.(carry('person-3-card-1', 'col-1')));
    act(() => kanban.onDragEnd?.(dropEvent('person-3-card-1', 'col-1')));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith('/allocations/move', {
        personId: 3,
        card: 1,
        projectId: 1,
        effectiveDate: '2026-10-20',
      })
    );
  });
});

describe('AllocationBoard: the keyboard', () => {
  const keyboardStart = (key: string) =>
    ({ active: { id: key }, activatorEvent: new KeyboardEvent('keydown', { code: 'Space' }) } as never);
  const pointerStart = (key: string) => ({ active: { id: key }, activatorEvent: new MouseEvent('mousedown') } as never);

  it('puts focus back on the card, which is a new element in its new column, after a keyboard drag moves it', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    await renderBoard();
    act(() => kanban.onDragStart?.(keyboardStart('person-3-card-1')));
    act(() => kanban.onValueChange?.(carry('person-3-card-1', 'col-1')));
    act(() => kanban.onDragEnd?.(dropEvent('person-3-card-1', 'col-1')));
    await waitFor(() => expect(cardOf('Linus Torvalds')).toHaveFocus());
    expect(column('Website').getByRole('link', { name: 'Linus Torvalds' })).toBeInTheDocument();
  });

  it('puts focus back on the card when a keyboard drag is cancelled after it went over another column', async () => {
    await renderBoard();
    act(() => kanban.onDragStart?.(keyboardStart('person-3-card-1')));
    act(() => kanban.onValueChange?.(carry('person-3-card-1', 'col-1')));
    act(() => kanban.onDragCancel?.({ active: { id: 'person-3-card-1' }, over: null } as never));
    await waitFor(() => expect(cardOf('Linus Torvalds')).toHaveFocus());
    expect(namesIn('Bench')).toEqual(['Linus Torvalds']);
  });

  it('does not take focus for a drag made with the pointer', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    await renderBoard();
    act(() => kanban.onDragStart?.(pointerStart('person-3-card-1')));
    act(() => kanban.onValueChange?.(carry('person-3-card-1', 'col-1')));
    act(() => kanban.onDragEnd?.(dropEvent('person-3-card-1', 'col-1')));
    await waitFor(() => expect(actions('Linus Torvalds')).toBeEnabled());
    expect(cardOf('Linus Torvalds')).not.toHaveFocus();
  });
});

describe('AllocationBoard: its size', () => {
  it('asks the shell for the whole area while it is up, and gives it back when it goes', async () => {
    const setFull = vi.fn();
    const view = renderWithProviders(
      <FullMainContext.Provider value={setFull}>
        <AllocationBoard />
      </FullMainContext.Provider>
    );
    await screen.findByRole('heading', { level: 2, name: 'Bench' });
    expect(setFull).toHaveBeenLastCalledWith(true);
    view.unmount();
    expect(setFull).toHaveBeenLastCalledWith(false);
  });

  it('fills the height it is given: the row of columns scrolls sideways inside it, and each column scrolls its cards', async () => {
    await renderBoard();
    const bench = screen.getByRole('group', { name: 'Bench' });
    const row = bench.closest('[data-slot="kanban-board"]')?.parentElement;
    expect(row).toHaveClass('min-h-0', 'flex-1', 'overflow-x-auto');
    expect(bench).toHaveClass('h-full', 'w-72', 'shrink-0');
    expect(within(bench).getByRole('list')).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
  });

  it('keeps a column’s head in view while its cards scroll', async () => {
    await renderBoard();
    const bench = screen.getByRole('group', { name: 'Bench' });
    expect(within(bench).getByRole('heading', { level: 2 }).parentElement).toHaveClass('shrink-0');
  });
});

describe('AllocationBoard: a person with several cards', () => {
  // Ada (₹85,000.00) has card 1 on Website and a second card on Mobile app; Grace is on Mobile app; Linus is on the bench.
  const adaCard2 = {
    ...adaOnWebsite,
    id: 20,
    card: 2,
    projectId: 2,
    project: { id: 2, name: 'Mobile app' },
    effectiveDate: '2026-06-01',
  };
  const twoCards = () => serve({ entries: [adaCard2, adaOnWebsite, graceOnMobile] });
  const cardsOfAda = () => [
    screen.getByRole('listitem', { name: 'Ada Lovelace, card 1 of 2' }),
    screen.getByRole('listitem', { name: 'Ada Lovelace, card 2 of 2' }),
  ];

  it('shows a card for each of the person’s cards, each in the column of its own project', async () => {
    twoCards();
    await renderBoard();
    expect(namesIn('Website')).toEqual(['Ada Lovelace']);
    expect(namesIn('Mobile app')).toEqual(['Ada Lovelace', 'Grace Hopper']);
    expect(cardsOfAda()).toHaveLength(2);
  });

  it('says "Card 1 of 2" and "Card 2 of 2" on them, and nothing of the kind on a person with one card', async () => {
    twoCards();
    await renderBoard();
    const [first, second] = cardsOfAda();
    expect(within(first).getByText('Card 1 of 2')).toBeInTheDocument();
    expect(within(second).getByText('Card 2 of 2')).toBeInTheDocument();
    expect(within(cardOf('Grace Hopper')).queryByText(/^Card /)).not.toBeInTheDocument();
  });

  it('shows each card with its share of the salary, split evenly', async () => {
    twoCards();
    await renderBoard();
    const [first, second] = cardsOfAda();
    expect(within(first).getByText('₹42,500.00')).toBeInTheDocument();
    expect(within(second).getByText('₹42,500.00')).toBeInTheDocument();
    expect(within(cardOf('Grace Hopper')).getByText('₹1,15,000.00')).toBeInTheDocument();
  });

  it('gives the paisa that does not divide to the lower card, so the two add up to the salary', async () => {
    serve({
      people: [{ ...ada, monthlySalaryPaise: 8_500_001 }, grace, linus],
      entries: [adaCard2, adaOnWebsite, graceOnMobile],
    });
    await renderBoard();
    const [first, second] = cardsOfAda();
    expect(within(first).getByText('₹42,500.01')).toBeInTheDocument();
    expect(within(second).getByText('₹42,500.00')).toBeInTheDocument();
  });

  it('counts cards in the head, and costs the column by its cards’ shares', async () => {
    twoCards();
    await renderBoard();
    expect(column('Website').getByText(headline('1 card, ₹42,500.00 a month'))).toBeInTheDocument();
    expect(column('Mobile app').getByText(headline('2 cards, ₹1,57,500.00 a month'))).toBeInTheDocument();
  });

  it('makes the heads add up to the salaries, whatever the cards: ₹85,000.00 + ₹1,15,000.00 across the board', async () => {
    twoCards();
    await renderBoard();
    const costs = ['Bench', 'Mobile app', 'Website'].map((name) => {
      const text = column(name).getByText(/a month$/).textContent ?? '';
      return (
        Number(
          text
            .replace(/^.*₹/, '')
            .replace(/ a month$/, '')
            .replace(/,/g, '')
        ) * 100
      );
    });
    expect(costs.reduce((sum, cost) => sum + cost, 0)).toBe(8_500_000 + 11_500_000);
  });

  it('names a card by its number when there are several, for the link, the Actions button and the drag', async () => {
    twoCards();
    await renderBoard();
    expect(screen.getByRole('button', { name: 'Actions for Ada Lovelace, card 1 of 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions for Ada Lovelace, card 2 of 2' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Ada Lovelace' })).toHaveLength(2);
    for (const link of screen.getAllByRole('link', { name: 'Ada Lovelace' })) {
      expect(link).toHaveAttribute('href', '/resources/people/1');
    }
  });

  it('moves a card by its number: the other card of the person stays where it is', async () => {
    twoCards();
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    await renderBoard();
    await user.click(screen.getByRole('button', { name: 'Actions for Ada Lovelace, card 2 of 2' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Bench' }));
    expect(coreApi.post).toHaveBeenCalledWith('/allocations/move', {
      personId: 1,
      card: 2,
      projectId: null,
      effectiveDate: '2026-10-20',
    });
    expect(namesIn('Bench')).toEqual(['Ada Lovelace', 'Linus Torvalds']);
    expect(namesIn('Website')).toEqual(['Ada Lovelace']);
    // Only the card that moved is locked while it saves.
    expect(screen.getByRole('button', { name: 'Actions for Ada Lovelace, card 1 of 2' })).toBeEnabled();
  });

  it('moves a card dragged to another column by its number too', async () => {
    twoCards();
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    await renderBoard();
    act(() => kanban.onValueChange?.(carry('person-1-card-2', 'col-1')));
    act(() => kanban.onDragEnd?.(dropEvent('person-1-card-2', 'col-1')));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith('/allocations/move', {
        personId: 1,
        card: 2,
        projectId: 1,
        effectiveDate: '2026-10-20',
      })
    );
  });

  it('keeps the keys of the cards apart, so the Kanban can tell them from each other and from the columns', async () => {
    twoCards();
    await renderBoard();
    expect(Object.values(kanban.value).flatMap((cards) => cards.map((card) => card.key))).toEqual([
      'person-3-card-1',
      'person-1-card-2',
      'person-2-card-1',
      'person-1-card-1',
    ]);
  });

  it('names the card, and its number, to a screen reader while it is dragged', async () => {
    twoCards();
    await renderBoard();
    const announce = kanban.accessibility?.announcements as Required<Announcements>;
    expect(announce.onDragStart({ active: { id: 'person-1-card-2' } } as never)).toBe(
      'Picked up Ada Lovelace, card 2 of 2, from Mobile app.'
    );
    expect(announce.onDragStart({ active: { id: 'person-2-card-1' } } as never)).toBe(
      'Picked up Grace Hopper, from Mobile app.'
    );
  });
});

describe('AllocationBoard: the card menu’s Duplicate and Delete card', () => {
  const adaCard2 = {
    ...adaOnWebsite,
    id: 20,
    card: 2,
    projectId: 2,
    project: { id: 2, name: 'Mobile app' },
    effectiveDate: '2026-06-01',
  };
  const actionsOf = (name: string) => screen.getByRole('button', { name: `Actions for ${name}` });
  const open = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(actionsOf(name));
    return screen.findByRole('menu');
  };

  it('lists Move to, a separator, Duplicate and Delete card', async () => {
    const user = userEvent.setup();
    await renderBoard();
    const menu = await open(user, 'Ada Lovelace');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['Bench', 'Mobile app', 'Duplicate', expect.stringContaining('Delete card')]);
    expect(within(menu).getByRole('separator')).toBeInTheDocument();
  });

  it('keeps Delete card disabled, and says why, while the person has one card', async () => {
    const user = userEvent.setup();
    await renderBoard();
    const menu = await open(user, 'Ada Lovelace');
    const remove = within(menu).getByRole('menuitem', { name: /Delete card/ });
    expect(remove).toHaveAttribute('aria-disabled', 'true');
    expect(within(menu).getByText('A person keeps at least one card')).toBeVisible();
    expect(remove).toHaveAccessibleDescription('A person keeps at least one card');
    await user.click(remove);
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('enables Delete card, with no reason on it, once the person has two cards', async () => {
    serve({ entries: [adaCard2, adaOnWebsite, graceOnMobile] });
    const user = userEvent.setup();
    await renderBoard();
    const menu = await open(user, 'Ada Lovelace, card 1 of 2');
    expect(within(menu).getByRole('menuitem', { name: 'Delete card' })).not.toHaveAttribute('aria-disabled', 'true');
    expect(within(menu).queryByText('A person keeps at least one card')).not.toBeInTheDocument();
  });

  it('duplicates a card with POST /allocations/cards dated today on the card’s own project', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    await renderBoard();
    const menu = await open(user, 'Ada Lovelace');
    await user.click(within(menu).getByRole('menuitem', { name: 'Duplicate' }));
    expect(coreApi.post).toHaveBeenCalledWith('/allocations/cards', {
      personId: 1,
      projectId: 1,
      effectiveDate: '2026-10-20',
    });
    expect(coreApi.post).toHaveBeenCalledTimes(1);
  });

  it('duplicates a card on the bench with a null project', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    await renderBoard();
    const menu = await open(user, 'Linus Torvalds');
    await user.click(within(menu).getByRole('menuitem', { name: 'Duplicate' }));
    expect(coreApi.post).toHaveBeenCalledWith('/allocations/cards', {
      personId: 3,
      projectId: null,
      effectiveDate: '2026-10-20',
    });
  });

  it('copies the project a card is on underneath when it shows on the bench because the project is not active', async () => {
    serve({ projects: [website, projectRows[1], legacyPortal] });
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    await renderBoard();
    expect(
      within(column('Bench').getByRole('link', { name: 'Grace Hopper' }).closest('li') as HTMLElement).getByText(
        'Last on Mobile app (on hold)'
      )
    ).toBeInTheDocument();
    const menu = await open(user, 'Grace Hopper');
    await user.click(within(menu).getByRole('menuitem', { name: 'Duplicate' }));
    expect(coreApi.post).toHaveBeenCalledWith('/allocations/cards', {
      personId: 2,
      projectId: 2,
      effectiveDate: '2026-10-20',
    });
  });

  it('shows the new card once the entries are read again, and splits the salary between the two', async () => {
    vi.mocked(coreApi.post).mockImplementation((async () => {
      state.entries = [adaCard2, ...state.entries];
      return saved;
    }) as never);
    const user = userEvent.setup();
    await renderBoard();
    const menu = await open(user, 'Ada Lovelace');
    await user.click(within(menu).getByRole('menuitem', { name: 'Duplicate' }));
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Ada Lovelace' })).toHaveLength(2));
    for (const card of [
      screen.getByRole('listitem', { name: 'Ada Lovelace, card 1 of 2' }),
      screen.getByRole('listitem', { name: 'Ada Lovelace, card 2 of 2' }),
    ]) {
      expect(within(card).getByText('₹42,500.00')).toBeInTheDocument();
    }
    expect(actionsOf('Ada Lovelace, card 1 of 2')).toBeEnabled();
    expect(actionsOf('Ada Lovelace, card 2 of 2')).toBeEnabled();
  });

  it('locks every card of the person while the copy is being saved, since their shares are about to change, and no one else’s', async () => {
    serve({ entries: [adaCard2, adaOnWebsite, graceOnMobile] });
    const first = deferred();
    vi.mocked(coreApi.post).mockImplementation(() => first.promise as never);
    const user = userEvent.setup();
    await renderBoard();
    const menu = await open(user, 'Ada Lovelace, card 1 of 2');
    await user.click(within(menu).getByRole('menuitem', { name: 'Duplicate' }));
    expect(actionsOf('Ada Lovelace, card 1 of 2')).toBeDisabled();
    expect(actionsOf('Ada Lovelace, card 2 of 2')).toBeDisabled();
    for (const card of [
      screen.getByRole('listitem', { name: 'Ada Lovelace, card 1 of 2' }),
      screen.getByRole('listitem', { name: 'Ada Lovelace, card 2 of 2' }),
    ]) {
      expect(card).toHaveAttribute('data-disabled', 'true');
    }
    expect(actionsOf('Grace Hopper')).toBeEnabled();
    expect(actionsOf('Linus Torvalds')).toBeEnabled();
    first.resolve(saved);
    await waitFor(() => expect(actionsOf('Ada Lovelace, card 1 of 2')).toBeEnabled());
    expect(actionsOf('Ada Lovelace, card 2 of 2')).toBeEnabled();
  });

  it('puts focus back on the Actions button of the card that was copied', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    await renderBoard();
    const menu = await open(user, 'Linus Torvalds');
    await user.click(within(menu).getByRole('menuitem', { name: 'Duplicate' }));
    await waitFor(() => expect(actionsOf('Linus Torvalds')).toHaveFocus());
  });

  it('says so, in the service’s words, and unlocks the cards when the copy is refused', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(failure(409, 'Referenced record does not exist'));
    const user = userEvent.setup();
    await renderBoard();
    const menu = await open(user, 'Ada Lovelace');
    await user.click(within(menu).getByRole('menuitem', { name: 'Duplicate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Referenced record does not exist');
    await waitFor(() => expect(actionsOf('Ada Lovelace')).toBeEnabled());
    expect(screen.getAllByRole('link', { name: 'Ada Lovelace' })).toHaveLength(1);
  });

  it('says that it did not save when the copy fails without a message of the service’s', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(failure(500));
    const user = userEvent.setup();
    await renderBoard();
    const menu = await open(user, 'Ada Lovelace');
    await user.click(within(menu).getByRole('menuitem', { name: 'Duplicate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save.');
  });

  it('deletes a card with POST /allocations/remove dated today, and shows the person’s whole salary on the card that is left', async () => {
    serve({ entries: [adaCard2, adaOnWebsite, graceOnMobile] });
    vi.mocked(coreApi.post).mockImplementation((async () => {
      state.entries = [
        { ...adaCard2, id: 21, removed: true, projectId: null, project: null, effectiveDate: '2026-10-20' },
        ...state.entries,
      ];
      return saved;
    }) as never);
    const user = userEvent.setup();
    await renderBoard();
    const menu = await open(user, 'Ada Lovelace, card 2 of 2');
    await user.click(within(menu).getByRole('menuitem', { name: 'Delete card' }));
    expect(coreApi.post).toHaveBeenCalledWith('/allocations/remove', {
      personId: 1,
      card: 2,
      effectiveDate: '2026-10-20',
    });
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Ada Lovelace' })).toHaveLength(1));
    const left = cardOf('Ada Lovelace');
    expect(within(left).getByText('₹85,000.00')).toBeInTheDocument();
    expect(within(left).queryByText(/^Card /)).not.toBeInTheDocument();
    expect(column('Mobile app').getByText(headline('1 card, ₹1,15,000.00 a month'))).toBeInTheDocument();
  });

  it('locks all of the person’s cards while a card is being deleted, and puts focus on the one that is left', async () => {
    serve({ entries: [adaCard2, adaOnWebsite, graceOnMobile] });
    const first = deferred();
    vi.mocked(coreApi.post).mockImplementation(() => first.promise as never);
    const user = userEvent.setup();
    await renderBoard();
    const menu = await open(user, 'Ada Lovelace, card 2 of 2');
    await user.click(within(menu).getByRole('menuitem', { name: 'Delete card' }));
    expect(actionsOf('Ada Lovelace, card 1 of 2')).toBeDisabled();
    expect(actionsOf('Ada Lovelace, card 2 of 2')).toBeDisabled();
    state.entries = [
      { ...adaCard2, id: 21, removed: true, projectId: null, project: null, effectiveDate: '2026-10-20' },
      ...state.entries,
    ];
    first.resolve(saved);
    await waitFor(() => expect(actionsOf('Ada Lovelace')).toHaveFocus());
  });

  it('says why in the service’s words, and keeps both cards, when the delete is refused', async () => {
    serve({ entries: [adaCard2, adaOnWebsite, graceOnMobile] });
    vi.mocked(coreApi.post).mockRejectedValue(failure(409, 'A person keeps at least one card'));
    const user = userEvent.setup();
    await renderBoard();
    const menu = await open(user, 'Ada Lovelace, card 2 of 2');
    await user.click(within(menu).getByRole('menuitem', { name: 'Delete card' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A person keeps at least one card');
    await waitFor(() => expect(actionsOf('Ada Lovelace, card 2 of 2')).toBeEnabled());
    expect(screen.getAllByRole('link', { name: 'Ada Lovelace' })).toHaveLength(2);
  });

  it('clears the message when another save is tried', async () => {
    vi.mocked(coreApi.post).mockRejectedValueOnce(failure(500)).mockResolvedValue(saved);
    const user = userEvent.setup();
    await renderBoard();
    await user.click(actionsOf('Ada Lovelace'));
    await user.click(await screen.findByRole('menuitem', { name: 'Duplicate' }));
    await screen.findByRole('alert');
    await waitFor(() => expect(actionsOf('Ada Lovelace')).toBeEnabled());
    await user.click(actionsOf('Ada Lovelace'));
    await user.click(await screen.findByRole('menuitem', { name: 'Duplicate' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('does not offer a copy or a removal of one card while another card of the person is being moved', async () => {
    serve({ entries: [adaCard2, adaOnWebsite, graceOnMobile] });
    const first = deferred();
    vi.mocked(coreApi.post).mockImplementation(() => first.promise as never);
    const user = userEvent.setup();
    await renderBoard();
    await user.click(actionsOf('Ada Lovelace, card 1 of 2'));
    await user.click(await screen.findByRole('menuitem', { name: 'Bench' }));
    const menu = await open(user, 'Ada Lovelace, card 2 of 2');
    expect(within(menu).getByRole('menuitem', { name: 'Duplicate' })).toHaveAttribute('aria-disabled', 'true');
    expect(within(menu).getByRole('menuitem', { name: 'Delete card' })).toHaveAttribute('aria-disabled', 'true');
    // The moves of the person's cards are free, and only the card that is being saved is locked.
    expect(within(menu).getByRole('menuitem', { name: 'Bench' })).not.toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Escape}');
    first.resolve(saved);
    await waitFor(() => expect(actionsOf('Ada Lovelace, card 1 of 2')).toBeEnabled());
  });

  it('does not ask for a second copy while the first is being saved', async () => {
    const first = deferred();
    vi.mocked(coreApi.post).mockImplementation(() => first.promise as never);
    const user = userEvent.setup();
    await renderBoard();
    const menu = await open(user, 'Ada Lovelace');
    await user.click(within(menu).getByRole('menuitem', { name: 'Duplicate' }));
    expect(actionsOf('Ada Lovelace')).toBeDisabled();
    expect(coreApi.post).toHaveBeenCalledTimes(1);
    first.resolve(saved);
    await waitFor(() => expect(actionsOf('Ada Lovelace')).toBeEnabled());
  });

  it('keeps a move of another person’s card going while a copy is being saved, and settles each on its own', async () => {
    const first = deferred();
    vi.mocked(coreApi.post)
      .mockImplementationOnce(() => first.promise as never)
      .mockResolvedValue(saved);
    const user = userEvent.setup();
    await renderBoard();
    const menu = await open(user, 'Ada Lovelace');
    await user.click(within(menu).getByRole('menuitem', { name: 'Duplicate' }));
    await user.click(actionsOf('Linus Torvalds'));
    await user.click(await screen.findByRole('menuitem', { name: 'Website' }));
    expect(coreApi.post).toHaveBeenCalledTimes(2);
    expect(namesIn('Website')).toEqual(['Ada Lovelace', 'Linus Torvalds']);
    first.resolve(saved);
    await waitFor(() => expect(actionsOf('Ada Lovelace')).toBeEnabled());
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
    expect(announce().onDragStart(args('person-1-card-1', null))).toBe('Picked up Ada Lovelace, from Website.');
    expect(announce().onDragOver(args('person-1-card-1', 'col-bench'))).toBe('Ada Lovelace is over Bench.');
    expect(announce().onDragOver(args('person-1-card-1', 'person-2-card-1'))).toBe('Ada Lovelace is over Mobile app.');
    expect(announce().onDragOver(args('person-1-card-1', null))).toBeUndefined();
    expect(announce().onDragEnd(args('person-1-card-1', 'col-2'))).toBe('Ada Lovelace was dropped on Mobile app.');
    expect(announce().onDragEnd(args('person-1-card-1', null))).toBe('Ada Lovelace was not dropped on a column.');
    expect(announce().onDragCancel(args('person-1-card-1', null))).toBe(
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
    expect(announce().onDragOver(args('person-3-card-1', 'person-3-card-1'))).toBe('Linus Torvalds is over Website.');
  });

  it('tells how to move a card by keyboard, and that the Actions menu does it too', async () => {
    await renderBoard();
    expect(kanban.accessibility?.screenReaderInstructions?.draggable).toMatch(
      /pick up a card, focus it and press space or enter/
    );
    expect(kanban.accessibility?.screenReaderInstructions?.draggable).toMatch(/Actions menu/);
  });
});
