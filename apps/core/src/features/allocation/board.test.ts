import { personRowSchema, type PersonRow } from '@/features/people/schema';
import { projectRowSchema, type ProjectRow } from '@/features/projects/schema';
import { allocationRows } from '@/test/fixtures/allocations';
import { personRows } from '@/test/fixtures/people';
import { projectRows } from '@/test/fixtures/projects';
import { buildBoard, byPerson, cardsOf, columnTotals, isOnStaff, shareOf, type BoardColumn } from './board';
import { allocationRowSchema, type AllocationRow } from './schema';

const TODAY = '2026-10-20';

/** A person with no dates and a salary of ₹1,00,000.00 a month unless the test says otherwise. */
const person = (id: number, name: string, over: Record<string, unknown> = {}): PersonRow =>
  personRowSchema.parse({
    ...personRows[0],
    id,
    name,
    joinDate: null,
    leaveDate: null,
    monthlySalaryPaise: 10_000_000,
    technologies: [],
    ...over,
  });

const project = (id: number, name: string, projectStatus = 'active'): ProjectRow =>
  projectRowSchema.parse({ ...projectRows[0], id, name, projectStatus });

/** An entry: from `effectiveDate` the person's card (1 unless `over` says another) is on the project, or on the bench when `on` is null. */
const entry = (
  id: number,
  who: PersonRow,
  on: { id: number; name: string } | null,
  effectiveDate: string,
  over: Record<string, unknown> = {}
): AllocationRow =>
  allocationRowSchema.parse({
    ...allocationRows[1],
    id,
    personId: who.id,
    card: 1,
    removed: false,
    projectId: on?.id ?? null,
    effectiveDate,
    note: null,
    person: { id: who.id, name: who.name },
    project: on ? { id: on.id, name: on.name } : null,
    ...over,
  });

/** An entry that says the card is gone from `effectiveDate`. */
const removal = (id: number, who: PersonRow, card: number, effectiveDate: string): AllocationRow =>
  entry(id, who, null, effectiveDate, { card, removed: true });

/** An entry of the person's card `card`. */
const onCard = (
  id: number,
  who: PersonRow,
  card: number,
  on: { id: number; name: string } | null,
  effectiveDate: string
) => entry(id, who, on, effectiveDate, { card });

const ada = person(1, 'Ada');
const grace = person(2, 'Grace');
const linus = person(3, 'Linus', { monthlySalaryPaise: null });
const apollo = project(10, 'Apollo');
const borealis = project(11, 'Borealis');

const names = (column: BoardColumn | undefined) => column?.cards.map((card) => card.person.name);
const columnOf = (board: BoardColumn[], key: string) => board.find((column) => column.key === key);

describe('isOnStaff', () => {
  it('counts a person with no dates', () => {
    expect(isOnStaff(person(1, 'Ada'), TODAY)).toBe(true);
  });

  it.each([
    ['joined long ago', '2024-01-15', true],
    ['joined yesterday', '2026-10-19', true],
    ['joined today', '2026-10-20', true],
    ['joins tomorrow', '2026-10-21', false],
    ['joins next year', '2027-01-04', false],
  ])('a person who %s', (_label, joinDate, expected) => {
    expect(isOnStaff(person(1, 'Ada', { joinDate }), TODAY)).toBe(expected);
  });

  it.each([
    ['left last year', '2025-06-30', false],
    ['left yesterday', '2026-10-19', false],
    ['leaves today, so is still here today', '2026-10-20', true],
    ['leaves tomorrow', '2026-10-21', true],
    ['leaves next year', '2027-03-31', true],
  ])('a person who %s', (_label, leaveDate, expected) => {
    expect(isOnStaff(person(1, 'Ada', { leaveDate }), TODAY)).toBe(expected);
  });

  it('needs both: joined and not yet left', () => {
    expect(isOnStaff(person(1, 'Ada', { joinDate: '2026-01-05', leaveDate: '2026-12-31' }), TODAY)).toBe(true);
    expect(isOnStaff(person(1, 'Ada', { joinDate: '2026-11-01', leaveDate: '2026-12-31' }), TODAY)).toBe(false);
    expect(isOnStaff(person(1, 'Ada', { joinDate: '2026-01-05', leaveDate: '2026-10-01' }), TODAY)).toBe(false);
  });
});

/** The cards of a person as (card number, id of the entry that places it, or null for the implicit card 1). */
const cardsSeen = (entries: AllocationRow[], personId = 1, today = TODAY) =>
  cardsOf(entries, personId, today).map(({ card, entry: placing }) => [card, placing?.id ?? null]);

describe('cardsOf: the cards a person has on a day', () => {
  it('is the implicit card 1, on the bench, for a person with no entries', () => {
    expect(cardsOf([], 1, TODAY)).toEqual([{ card: 1, entry: null }]);
  });

  it('is card 1 with the latest entry of card 1 on or before the day', () => {
    const entries = [
      entry(3, ada, apollo, '2026-09-01'),
      entry(2, ada, borealis, '2026-05-01'),
      entry(1, ada, null, '2026-01-01'),
    ];
    expect(cardsSeen(entries)).toEqual([[1, 3]]);
    expect(cardsSeen(entries, 1, '2026-08-31')).toEqual([[1, 2]]);
    expect(cardsSeen(entries, 1, '2026-01-01')).toEqual([[1, 1]]);
  });

  it('counts an entry dated today, and not one dated tomorrow', () => {
    const entries = [entry(2, ada, apollo, '2026-10-20'), entry(1, ada, null, '2026-01-01')];
    expect(cardsSeen(entries)).toEqual([[1, 2]]);
    expect(cardsSeen(entries, 1, '2026-10-19')).toEqual([[1, 1]]);
  });

  it('is still the implicit card 1 when card 1 has only entries that start later', () => {
    expect(cardsSeen([entry(1, ada, apollo, '2026-10-21')])).toEqual([[1, null]]);
  });

  it('does not depend on the order of the list', () => {
    const entries = [
      entry(2, ada, borealis, '2026-05-01'),
      entry(3, ada, apollo, '2026-09-01'),
      entry(1, ada, null, '2026-01-01'),
    ];
    expect(cardsSeen(entries)).toEqual([[1, 3]]);
    expect(cardsSeen([...entries].reverse())).toEqual([[1, 3]]);
  });

  it('keeps an entry backfilled before a later one from changing where the card is now', () => {
    // Entered last (id 9) but dated earliest: the card is still on Apollo.
    expect(cardsSeen([entry(2, ada, apollo, '2026-03-12'), entry(9, ada, null, '2026-01-05')])).toEqual([[1, 2]]);
  });

  it('makes the previous entry current once the current one is gone from the list', () => {
    const entries = [entry(2, ada, apollo, '2026-03-12'), entry(1, ada, borealis, '2026-01-05')];
    expect(cardsSeen(entries)).toEqual([[1, 2]]);
    // The service no longer lists a deleted entry.
    expect(cardsSeen(entries.filter((row) => row.id !== 2))).toEqual([[1, 1]]);
  });

  it('breaks a tie of dates by the later id: two entries cannot share a card and a day, but if they did', () => {
    expect(cardsSeen([entry(4, ada, apollo, '2026-03-12'), entry(7, ada, borealis, '2026-03-12')])).toEqual([[1, 7]]);
  });

  it('reads only the person asked about', () => {
    const entries = [entry(2, grace, borealis, '2026-09-01'), entry(1, ada, apollo, '2026-03-12')];
    expect(cardsSeen(entries, 1)).toEqual([[1, 1]]);
    expect(cardsSeen(entries, 2)).toEqual([[1, 2]]);
    expect(cardsSeen([entry(1, grace, apollo, '2026-03-12')], 1)).toEqual([[1, null]]);
  });

  it('has a card 2 from the day of its first entry, and not before', () => {
    const entries = [onCard(2, ada, 2, borealis, '2026-06-01'), entry(1, ada, apollo, '2026-03-12')];
    expect(cardsSeen(entries)).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(cardsSeen(entries, 1, '2026-05-31')).toEqual([[1, 1]]);
    expect(cardsSeen(entries, 1, '2026-06-01')).toEqual([
      [1, 1],
      [2, 2],
    ]);
  });

  it('has no card 2 when its only entries start later', () => {
    expect(cardsSeen([onCard(2, ada, 2, borealis, '2026-10-21'), entry(1, ada, apollo, '2026-03-12')])).toEqual([
      [1, 1],
    ]);
  });

  it('takes each card’s latest entry on its own: a move of one card leaves the other where it is', () => {
    const entries = [
      onCard(4, ada, 2, null, '2026-09-01'),
      entry(3, ada, borealis, '2026-08-01'),
      onCard(2, ada, 2, apollo, '2026-06-01'),
      entry(1, ada, apollo, '2026-03-12'),
    ];
    expect(cardsSeen(entries)).toEqual([
      [1, 3],
      [2, 4],
    ]);
    expect(cardsSeen(entries, 1, '2026-08-15')).toEqual([
      [1, 3],
      [2, 2],
    ]);
  });

  it('orders the cards by number, whatever the order of the list and of their entries', () => {
    const entries = [
      onCard(1, ada, 3, apollo, '2026-06-01'),
      onCard(2, ada, 2, apollo, '2026-06-02'),
      entry(3, ada, null, '2026-06-03'),
    ];
    expect(cardsOf(entries, 1, TODAY).map((placed) => placed.card)).toEqual([1, 2, 3]);
  });

  it('drops a card whose latest entry says it is removed', () => {
    const entries = [
      removal(3, ada, 2, '2026-07-01'),
      onCard(2, ada, 2, borealis, '2026-06-01'),
      entry(1, ada, apollo, '2026-03-12'),
    ];
    expect(cardsSeen(entries)).toEqual([[1, 1]]);
    // Before the removal it was there.
    expect(cardsSeen(entries, 1, '2026-06-30')).toEqual([
      [1, 1],
      [2, 2],
    ]);
  });

  it('brings a removed card back when a later entry of the same card places it again', () => {
    const entries = [
      onCard(4, ada, 2, apollo, '2026-09-01'),
      removal(3, ada, 2, '2026-07-01'),
      onCard(2, ada, 2, borealis, '2026-06-01'),
      entry(1, ada, apollo, '2026-03-12'),
    ];
    expect(cardsSeen(entries)).toEqual([
      [1, 1],
      [2, 4],
    ]);
    expect(cardsSeen(entries, 1, '2026-08-01')).toEqual([[1, 1]]);
  });

  it('drops card 1 too when it is the one removed and another card is left', () => {
    const entries = [
      removal(3, ada, 1, '2026-07-01'),
      onCard(2, ada, 2, borealis, '2026-06-01'),
      entry(1, ada, apollo, '2026-03-12'),
    ];
    expect(cardsSeen(entries)).toEqual([[2, 2]]);
  });

  it('stands in the implicit card 1, on the bench, when every card is removed', () => {
    const entries = [
      removal(4, ada, 2, '2026-07-02'),
      removal(3, ada, 1, '2026-07-01'),
      onCard(2, ada, 2, borealis, '2026-06-01'),
      entry(1, ada, apollo, '2026-03-12'),
    ];
    expect(cardsOf(entries, 1, TODAY)).toEqual([{ card: 1, entry: null }]);
  });

  it('does not count a removal that starts later', () => {
    expect(cardsSeen([removal(2, ada, 2, '2026-10-21'), onCard(1, ada, 2, borealis, '2026-06-01')])).toEqual([
      [1, null],
      [2, 1],
    ]);
  });
});

describe('shareOf: a person’s salary split between their cards', () => {
  it('is the whole salary for one card', () => {
    expect(shareOf(8_500_000, 1, 0)).toBe(8_500_000);
  });

  it('is an even split when the salary divides', () => {
    expect([0, 1].map((index) => shareOf(10_000_000, 2, index))).toEqual([5_000_000, 5_000_000]);
  });

  it('gives the leftover paise one each to the lowest cards first: 100001 over 3 is 33334, 33334, 33333', () => {
    expect([0, 1, 2].map((index) => shareOf(100_001, 3, index))).toEqual([33_334, 33_334, 33_333]);
    expect([0, 1, 2].map((index) => shareOf(100_002, 3, index))).toEqual([33_334, 33_334, 33_334]);
    expect([0, 1, 2].map((index) => shareOf(100_000, 3, index))).toEqual([33_334, 33_333, 33_333]);
  });

  it('splits 1 paisa over 2 cards as 1 and 0', () => {
    expect([0, 1].map((index) => shareOf(1, 2, index))).toEqual([1, 0]);
  });

  it.each([
    [0, 3],
    [1, 2],
    [7, 3],
    [100_001, 3],
    [99_999_999, 7],
    [8_500_075, 4],
    [10_000_000_000, 13],
  ])('adds up to the salary exactly, with nothing lost: %i paise over %i cards', (salary, count) => {
    const shares = Array.from({ length: count }, (_, index) => shareOf(salary, count, index) as number);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(salary);
    // No share is more than a paisa from another, and the bigger ones come first.
    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
    expect([...shares].sort((a, b) => b - a)).toEqual(shares);
  });

  it('is nothing for a salary of zero, which is a salary', () => {
    expect([0, 1, 2].map((index) => shareOf(0, 3, index))).toEqual([0, 0, 0]);
  });

  it('is null for a person with no salary on file, however many cards', () => {
    expect(shareOf(null, 1, 0)).toBeNull();
    expect([0, 1].map((index) => shareOf(null, 2, index))).toEqual([null, null]);
  });
});

describe('buildBoard: the columns', () => {
  it('puts the bench first, then the active projects by name, whatever the case', () => {
    const board = buildBoard({
      people: [],
      projects: [project(12, 'zephyr'), borealis, project(13, 'Apollo 2'), apollo],
      entries: [],
      today: TODAY,
    });
    expect(board.map((column) => column.key)).toEqual(['col-bench', 'col-10', 'col-13', 'col-11', 'col-12']);
    expect(board.map((column) => column.project?.name ?? null)).toEqual([
      null,
      'Apollo',
      'Apollo 2',
      'Borealis',
      'zephyr',
    ]);
  });

  it('breaks a tie of names by id', () => {
    const board = buildBoard({
      people: [],
      projects: [project(21, 'Apollo'), project(20, 'apollo')],
      entries: [],
      today: TODAY,
    });
    expect(board.map((column) => column.key)).toEqual(['col-bench', 'col-20', 'col-21']);
  });

  it('makes a column for an active project with nobody on it, and for the bench with nobody on it', () => {
    const board = buildBoard({ people: [], projects: [apollo], entries: [], today: TODAY });
    expect(board).toHaveLength(2);
    for (const column of board) {
      expect(column).toMatchObject({ cards: [], monthlyCostPaise: 0, withoutSalary: 0 });
    }
  });

  it('makes no column for a project that is on hold or completed', () => {
    const board = buildBoard({
      people: [],
      projects: [apollo, project(11, 'Borealis', 'on_hold'), project(12, 'Cirrus', 'completed')],
      entries: [],
      today: TODAY,
    });
    expect(board.map((column) => column.key)).toEqual(['col-bench', 'col-10']);
  });

  it('gives the bench column no project, and a project column its project', () => {
    const board = buildBoard({ people: [], projects: [apollo], entries: [], today: TODAY });
    expect(board[0].project).toBeNull();
    expect(board[1].project).toBe(apollo);
  });
});

describe('buildBoard: where each person stands', () => {
  it('puts a person on the project of their latest entry, since its date', () => {
    const board = buildBoard({
      people: [ada],
      projects: [apollo, borealis],
      entries: [entry(2, ada, apollo, '2026-03-12'), entry(1, ada, null, '2026-01-05')],
      today: TODAY,
    });
    expect(names(columnOf(board, 'col-10'))).toEqual(['Ada']);
    expect(columnOf(board, 'col-10')?.cards[0]).toMatchObject({
      key: 'person-1-card-1',
      person: ada,
      card: 1,
      cardCount: 1,
      projectId: 10,
      salaryShare: 10_000_000,
      since: '2026-03-12',
      note: null,
    });
    expect(names(columnOf(board, 'col-bench'))).toEqual([]);
    expect(names(columnOf(board, 'col-11'))).toEqual([]);
  });

  it('puts a person with no entry on the bench, with no date and no note', () => {
    const board = buildBoard({ people: [ada], projects: [apollo], entries: [], today: TODAY });
    expect(columnOf(board, 'col-bench')?.cards).toEqual([
      {
        key: 'person-1-card-1',
        person: ada,
        card: 1,
        cardCount: 1,
        projectId: null,
        salaryShare: 10_000_000,
        since: null,
        note: null,
      },
    ]);
  });

  it('puts a person whose latest entry is the bench on the bench, since that day, and with no note', () => {
    const board = buildBoard({
      people: [ada],
      projects: [apollo],
      entries: [entry(2, ada, null, '2026-09-01'), entry(1, ada, apollo, '2026-03-12')],
      today: TODAY,
    });
    expect(columnOf(board, 'col-bench')?.cards).toEqual([
      {
        key: 'person-1-card-1',
        person: ada,
        card: 1,
        cardCount: 1,
        projectId: null,
        salaryShare: 10_000_000,
        since: '2026-09-01',
        note: null,
      },
    ]);
    expect(names(columnOf(board, 'col-10'))).toEqual([]);
  });

  it('does not use the entry’s own note as the card’s note', () => {
    const noted = { ...entry(1, ada, null, '2026-09-01'), note: 'Between projects' };
    const board = buildBoard({ people: [ada], projects: [], entries: [noted], today: TODAY });
    expect(columnOf(board, 'col-bench')?.cards[0].note).toBeNull();
  });

  it('keeps an entry backfilled before a later one from changing where the person is now', () => {
    const board = buildBoard({
      people: [ada],
      projects: [apollo, borealis],
      entries: [entry(2, ada, apollo, '2026-03-12'), entry(9, ada, borealis, '2026-01-05')],
      today: TODAY,
    });
    expect(names(columnOf(board, 'col-10'))).toEqual(['Ada']);
    expect(names(columnOf(board, 'col-11'))).toEqual([]);
  });

  it('puts the person back on the earlier entry when the current one is deleted (it is gone from the list)', () => {
    const both = [entry(2, ada, apollo, '2026-03-12'), entry(1, ada, borealis, '2026-01-05')];
    const before = buildBoard({ people: [ada], projects: [apollo, borealis], entries: both, today: TODAY });
    const after = buildBoard({ people: [ada], projects: [apollo, borealis], entries: [both[1]], today: TODAY });
    expect(names(columnOf(before, 'col-10'))).toEqual(['Ada']);
    expect(names(columnOf(after, 'col-11'))).toEqual(['Ada']);
    expect(columnOf(after, 'col-11')?.cards[0].since).toBe('2026-01-05');
  });

  it('does not move anyone for an entry dated in the future', () => {
    const board = buildBoard({
      people: [ada],
      projects: [apollo, borealis],
      entries: [entry(2, ada, borealis, '2026-10-21'), entry(1, ada, apollo, '2026-03-12')],
      today: TODAY,
    });
    expect(names(columnOf(board, 'col-10'))).toEqual(['Ada']);
    expect(names(columnOf(board, 'col-11'))).toEqual([]);
  });

  it('moves a person whose entry is dated today', () => {
    const board = buildBoard({
      people: [ada],
      projects: [apollo, borealis],
      entries: [entry(2, ada, borealis, '2026-10-20'), entry(1, ada, apollo, '2026-03-12')],
      today: TODAY,
    });
    expect(names(columnOf(board, 'col-11'))).toEqual(['Ada']);
  });

  it('ignores entries of people who are not in the list', () => {
    const board = buildBoard({
      people: [ada],
      projects: [apollo],
      entries: [entry(2, grace, apollo, '2026-03-12')],
      today: TODAY,
    });
    expect(names(columnOf(board, 'col-10'))).toEqual([]);
    expect(names(columnOf(board, 'col-bench'))).toEqual(['Ada']);
  });

  it('shows each person once, whatever their history', () => {
    const board = buildBoard({
      people: [ada, grace],
      projects: [apollo, borealis],
      entries: [
        entry(4, ada, borealis, '2026-08-01'),
        entry(3, grace, apollo, '2026-06-01'),
        entry(2, ada, apollo, '2026-03-12'),
        entry(1, ada, null, '2026-01-05'),
      ],
      today: TODAY,
    });
    expect(board.flatMap((column) => column.cards.map((card) => card.person.name)).sort()).toEqual(['Ada', 'Grace']);
  });
});

describe('buildBoard: who is on the board', () => {
  it('leaves out a person who left before today, and one who joins after it', () => {
    const left = person(4, 'Left', { leaveDate: '2026-10-19' });
    const notYet = person(5, 'Not yet', { joinDate: '2026-10-21' });
    const board = buildBoard({
      people: [ada, left, notYet],
      projects: [apollo],
      entries: [entry(1, left, apollo, '2026-03-12'), entry(2, notYet, apollo, '2026-03-12')],
      today: TODAY,
    });
    expect(board.flatMap((column) => column.cards.map((card) => card.person.name))).toEqual(['Ada']);
    // Nor do they cost anything.
    expect(columnOf(board, 'col-10')).toMatchObject({ cards: [], monthlyCostPaise: 0 });
  });

  it('keeps a person whose Left date is today, and one who joined today', () => {
    const leavingToday = person(4, 'Leaving', { leaveDate: TODAY });
    const joinedToday = person(5, 'Joined', { joinDate: TODAY });
    const board = buildBoard({ people: [leavingToday, joinedToday], projects: [], entries: [], today: TODAY });
    expect(names(columnOf(board, 'col-bench'))).toEqual(['Joined', 'Leaving']);
  });
});

describe('buildBoard: a project that is no longer active', () => {
  it.each([
    ['on_hold', 'Last on Apollo (on hold)'],
    ['completed', 'Last on Apollo (completed)'],
  ])('puts the people of a %s project on the bench, with the note %j', (status, note) => {
    const board = buildBoard({
      people: [ada],
      projects: [project(10, 'Apollo', status), borealis],
      entries: [entry(1, ada, apollo, '2026-03-12')],
      today: TODAY,
    });
    expect(board.map((column) => column.key)).toEqual(['col-bench', 'col-11']);
    // The card keeps the project it is on underneath, which a copy of it starts from.
    expect(columnOf(board, 'col-bench')?.cards).toEqual([
      {
        key: 'person-1-card-1',
        person: ada,
        card: 1,
        cardCount: 1,
        projectId: 10,
        salaryShare: 10_000_000,
        since: null,
        note,
      },
    ]);
  });

  it('puts the people of a project that is not in the list at all (deleted) on the bench, and says so', () => {
    const board = buildBoard({
      people: [ada],
      projects: [borealis],
      entries: [entry(1, ada, apollo, '2026-03-12')],
      today: TODAY,
    });
    expect(columnOf(board, 'col-bench')?.cards).toEqual([
      {
        key: 'person-1-card-1',
        person: ada,
        card: 1,
        cardCount: 1,
        projectId: 10,
        salaryShare: 10_000_000,
        since: null,
        note: 'Last on Apollo (deleted)',
      },
    ]);
  });

  it('reads the name from the entry, which keeps it when the project is deleted', () => {
    const gone = { id: 99, name: 'Old name kept in the ledger' };
    const board = buildBoard({
      people: [ada],
      projects: [],
      entries: [entry(1, ada, gone, '2026-03-12')],
      today: TODAY,
    });
    expect(columnOf(board, 'col-bench')?.cards[0].note).toBe('Last on Old name kept in the ledger (deleted)');
  });

  it('puts the person back on a project that is active again, with no note', () => {
    const entries = [entry(1, ada, apollo, '2026-03-12')];
    const held = buildBoard({ people: [ada], projects: [project(10, 'Apollo', 'on_hold')], entries, today: TODAY });
    const back = buildBoard({ people: [ada], projects: [apollo], entries, today: TODAY });
    expect(names(columnOf(held, 'col-bench'))).toEqual(['Ada']);
    expect(columnOf(back, 'col-10')?.cards[0]).toMatchObject({ since: '2026-03-12', note: null });
  });

  it('counts the person’s salary in the bench’s cost', () => {
    const board = buildBoard({
      people: [ada],
      projects: [project(10, 'Apollo', 'on_hold')],
      entries: [entry(1, ada, apollo, '2026-03-12')],
      today: TODAY,
    });
    expect(columnOf(board, 'col-bench')).toMatchObject({ monthlyCostPaise: 10_000_000, withoutSalary: 0 });
  });
});

describe('buildBoard: the cost of a column', () => {
  it('adds up the monthly salaries of the people in it', () => {
    const board = buildBoard({
      people: [
        person(1, 'Ada', { monthlySalaryPaise: 8_500_000 }),
        person(2, 'Grace', { monthlySalaryPaise: 11_500_000 }),
      ],
      projects: [apollo],
      entries: [entry(1, person(1, 'Ada'), apollo, '2026-03-12'), entry(2, person(2, 'Grace'), apollo, '2026-03-12')],
      today: TODAY,
    });
    expect(columnOf(board, 'col-10')).toMatchObject({ monthlyCostPaise: 20_000_000, withoutSalary: 0 });
    expect(columnOf(board, 'col-bench')).toMatchObject({ monthlyCostPaise: 0 });
  });

  it('counts a person with no salary as 0, and says how many have none', () => {
    const board = buildBoard({
      people: [ada, linus, person(4, 'Mary', { monthlySalaryPaise: null })],
      projects: [apollo],
      entries: [
        entry(1, ada, apollo, '2026-03-12'),
        entry(2, linus, apollo, '2026-03-12'),
        entry(3, person(4, 'Mary'), apollo, '2026-03-12'),
      ],
      today: TODAY,
    });
    expect(columnOf(board, 'col-10')).toMatchObject({ monthlyCostPaise: 10_000_000, withoutSalary: 2 });
    expect(names(columnOf(board, 'col-10'))).toEqual(['Ada', 'Linus', 'Mary']);
  });

  it('counts a salary of zero as a salary, not as a missing one', () => {
    const intern = person(5, 'Intern', { monthlySalaryPaise: 0 });
    const board = buildBoard({ people: [intern], projects: [], entries: [], today: TODAY });
    expect(columnOf(board, 'col-bench')).toMatchObject({ monthlyCostPaise: 0, withoutSalary: 0 });
  });

  it('costs the bench for those on it, with no entry or an entry to the bench', () => {
    const board = buildBoard({
      people: [ada, grace, linus],
      projects: [apollo],
      entries: [entry(1, grace, null, '2026-09-01')],
      today: TODAY,
    });
    expect(columnOf(board, 'col-bench')).toMatchObject({ monthlyCostPaise: 20_000_000, withoutSalary: 1 });
    expect(names(columnOf(board, 'col-bench'))).toEqual(['Ada', 'Grace', 'Linus']);
  });

  it('keeps the cost in whole paise, exact to the unit', () => {
    const board = buildBoard({
      people: [person(1, 'Ada', { monthlySalaryPaise: 8_500_075 }), person(2, 'Grace', { monthlySalaryPaise: 1 })],
      projects: [],
      entries: [],
      today: TODAY,
    });
    expect(columnOf(board, 'col-bench')?.monthlyCostPaise).toBe(8_500_076);
  });
});

describe('buildBoard: the cards', () => {
  it('lists the cards of a column by name, whatever the case, then by id', () => {
    const board = buildBoard({
      people: [person(3, 'zoe'), person(2, 'Bea'), person(1, 'bea'), person(4, 'Adam')],
      projects: [],
      entries: [],
      today: TODAY,
    });
    expect(columnOf(board, 'col-bench')?.cards.map((card) => card.key)).toEqual([
      'person-4-card-1',
      'person-1-card-1',
      'person-2-card-1',
      'person-3-card-1',
    ]);
  });

  it('keys columns and cards apart, so the two kinds of id cannot collide', () => {
    const board = buildBoard({
      people: [person(10, 'Ada')],
      projects: [apollo],
      entries: [entry(1, person(10, 'Ada'), apollo, '2026-03-12')],
      today: TODAY,
    });
    const keys = [
      ...board.map((column) => column.key),
      ...board.flatMap((column) => column.cards.map((card) => card.key)),
    ];
    expect(keys).toEqual(['col-bench', 'col-10', 'person-10-card-1']);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('does not change the lists it is given', () => {
    const people = [person(2, 'Grace'), person(1, 'Ada')];
    const projects = [borealis, apollo];
    const entries = [entry(1, people[0], apollo, '2026-03-12'), entry(2, people[1], borealis, '2026-03-12')];
    const before = JSON.stringify({ people, projects, entries });
    buildBoard({ people, projects, entries, today: TODAY });
    expect(JSON.stringify({ people, projects, entries })).toBe(before);
  });
});

describe('buildBoard: a person with several cards', () => {
  const senior = person(1, 'Senior', { monthlySalaryPaise: 10_000_001 });
  const twoCards = (second: AllocationRow) => [second, entry(1, senior, apollo, '2026-03-12')];

  it('puts each card in the column of its own project, keyed by person and card, each with its share of the salary', () => {
    const board = buildBoard({
      people: [senior],
      projects: [apollo, borealis],
      entries: twoCards(onCard(2, senior, 2, borealis, '2026-06-01')),
      today: TODAY,
    });
    expect(columnOf(board, 'col-10')?.cards).toEqual([
      {
        key: 'person-1-card-1',
        person: senior,
        card: 1,
        cardCount: 2,
        projectId: 10,
        salaryShare: 5_000_001,
        since: '2026-03-12',
        note: null,
      },
    ]);
    expect(columnOf(board, 'col-11')?.cards).toEqual([
      {
        key: 'person-1-card-2',
        person: senior,
        card: 2,
        cardCount: 2,
        projectId: 11,
        salaryShare: 5_000_000,
        since: '2026-06-01',
        note: null,
      },
    ]);
  });

  it('makes the cost of the columns add up to the whole salary, to the paisa', () => {
    const board = buildBoard({
      people: [senior],
      projects: [apollo, borealis],
      entries: twoCards(onCard(2, senior, 2, borealis, '2026-06-01')),
      today: TODAY,
    });
    expect(columnOf(board, 'col-10')?.monthlyCostPaise).toBe(5_000_001);
    expect(columnOf(board, 'col-11')?.monthlyCostPaise).toBe(5_000_000);
    expect(board.reduce((sum, column) => sum + column.monthlyCostPaise, 0)).toBe(10_000_001);
  });

  it('puts two cards in one column when both are on the project (a card just copied), side by side, by card number', () => {
    const board = buildBoard({
      people: [senior],
      projects: [apollo],
      entries: twoCards(onCard(2, senior, 2, apollo, '2026-10-20')),
      today: TODAY,
    });
    expect(columnOf(board, 'col-10')?.cards.map((card) => card.key)).toEqual(['person-1-card-1', 'person-1-card-2']);
    expect(columnOf(board, 'col-10')).toMatchObject({ monthlyCostPaise: 10_000_001, withoutSalary: 0 });
  });

  it('counts a card on the bench as a card of the person, with a share', () => {
    const board = buildBoard({
      people: [senior],
      projects: [apollo],
      entries: twoCards(onCard(2, senior, 2, null, '2026-06-01')),
      today: TODAY,
    });
    expect(columnOf(board, 'col-bench')?.cards).toMatchObject([
      { key: 'person-1-card-2', projectId: null, salaryShare: 5_000_000 },
    ]);
  });

  it('shows a card whose project is not active on the bench with a note, and keeps the project it is on underneath', () => {
    const board = buildBoard({
      people: [senior],
      projects: [apollo, project(11, 'Borealis', 'on_hold')],
      entries: twoCards(onCard(2, senior, 2, borealis, '2026-06-01')),
      today: TODAY,
    });
    expect(columnOf(board, 'col-bench')?.cards).toMatchObject([
      {
        key: 'person-1-card-2',
        projectId: 11,
        note: 'Last on Borealis (on hold)',
        since: null,
        salaryShare: 5_000_000,
      },
    ]);
    expect(names(columnOf(board, 'col-10'))).toEqual(['Senior']);
  });

  it('gives the whole salary to the card that is left when the other is removed', () => {
    const board = buildBoard({
      people: [senior],
      projects: [apollo, borealis],
      entries: [removal(3, senior, 2, '2026-07-01'), ...twoCards(onCard(2, senior, 2, borealis, '2026-06-01'))],
      today: TODAY,
    });
    expect(names(columnOf(board, 'col-11'))).toEqual([]);
    expect(columnOf(board, 'col-10')?.cards).toMatchObject([
      { key: 'person-1-card-1', cardCount: 1, salaryShare: 10_000_001 },
    ]);
  });

  it('counts the cards without a salary, one for each, in the column’s "without a salary"', () => {
    const unpaid = person(1, 'Unpaid', { monthlySalaryPaise: null });
    const board = buildBoard({
      people: [unpaid],
      projects: [apollo],
      entries: [onCard(2, unpaid, 2, apollo, '2026-06-01'), entry(1, unpaid, apollo, '2026-03-12')],
      today: TODAY,
    });
    expect(columnOf(board, 'col-10')).toMatchObject({ monthlyCostPaise: 0, withoutSalary: 2 });
    expect(columnOf(board, 'col-10')?.cards.map((card) => card.salaryShare)).toEqual([null, null]);
  });

  it('keeps a salary of zero a salary on every card', () => {
    const intern = person(1, 'Intern', { monthlySalaryPaise: 0 });
    const board = buildBoard({
      people: [intern],
      projects: [apollo],
      entries: [onCard(2, intern, 2, apollo, '2026-06-01'), entry(1, intern, apollo, '2026-03-12')],
      today: TODAY,
    });
    expect(columnOf(board, 'col-10')).toMatchObject({ monthlyCostPaise: 0, withoutSalary: 0 });
  });

  it('leaves a person who has left or not joined off the board, all their cards', () => {
    const left = person(4, 'Left', { leaveDate: '2026-10-19' });
    const board = buildBoard({
      people: [left],
      projects: [apollo],
      entries: [onCard(2, left, 2, apollo, '2026-06-01'), entry(1, left, apollo, '2026-03-12')],
      today: TODAY,
    });
    expect(board.flatMap((column) => column.cards)).toEqual([]);
  });

  it('lists a column’s cards by name, then by card number', () => {
    const bea = person(2, 'Bea', { monthlySalaryPaise: 2_000_000 });
    const board = buildBoard({
      people: [senior, bea],
      projects: [apollo],
      entries: [
        onCard(4, senior, 2, apollo, '2026-06-01'),
        entry(3, bea, apollo, '2026-03-12'),
        onCard(2, bea, 2, apollo, '2026-06-01'),
        entry(1, senior, apollo, '2026-03-12'),
      ],
      today: TODAY,
    });
    expect(columnOf(board, 'col-10')?.cards.map((card) => card.key)).toEqual([
      'person-2-card-1',
      'person-2-card-2',
      'person-1-card-1',
      'person-1-card-2',
    ]);
  });

  it('makes a card of every person who has none left, so nobody vanishes from the board', () => {
    const board = buildBoard({
      people: [senior],
      projects: [apollo],
      entries: [removal(1, senior, 1, '2026-07-01')],
      today: TODAY,
    });
    expect(columnOf(board, 'col-bench')?.cards).toMatchObject([
      { key: 'person-1-card-1', cardCount: 1, salaryShare: 10_000_001, since: null, note: null },
    ]);
  });
});

describe('columnTotals', () => {
  const benchCards = (...people: PersonRow[]) =>
    columnOf(buildBoard({ people, projects: [], entries: [], today: TODAY }), 'col-bench')?.cards ?? [];

  it('adds up the monthly salaries and counts the people with none', () => {
    expect(columnTotals(benchCards(ada, grace, linus))).toEqual({ monthlyCostPaise: 20_000_000, withoutSalary: 1 });
  });

  it('is nothing for no cards', () => {
    expect(columnTotals([])).toEqual({ monthlyCostPaise: 0, withoutSalary: 0 });
  });

  it('counts a salary of zero as a salary', () => {
    expect(columnTotals(benchCards(person(5, 'Intern', { monthlySalaryPaise: 0 })))).toEqual({
      monthlyCostPaise: 0,
      withoutSalary: 0,
    });
  });

  it('adds up the shares of the cards, so a person on two cards of the column costs their whole salary', () => {
    const senior = person(1, 'Senior', { monthlySalaryPaise: 9 });
    const board = buildBoard({
      people: [senior],
      projects: [apollo],
      entries: [onCard(2, senior, 2, apollo, '2026-06-01'), entry(1, senior, apollo, '2026-03-12')],
      today: TODAY,
    });
    expect(columnTotals(columnOf(board, 'col-10')?.cards ?? [])).toEqual({ monthlyCostPaise: 9, withoutSalary: 0 });
  });

  it('counts a card with no salary share as one without a salary, for each card', () => {
    const unpaid = person(1, 'Unpaid', { monthlySalaryPaise: null });
    const board = buildBoard({
      people: [unpaid],
      projects: [apollo],
      entries: [onCard(2, unpaid, 2, apollo, '2026-06-01'), entry(1, unpaid, apollo, '2026-03-12')],
      today: TODAY,
    });
    expect(columnTotals(columnOf(board, 'col-10')?.cards ?? [])).toEqual({ monthlyCostPaise: 0, withoutSalary: 2 });
  });

  it('is what a column of the board carries', () => {
    const board = buildBoard({ people: [ada, linus], projects: [], entries: [], today: TODAY });
    const bench = columnOf(board, 'col-bench');
    expect(bench).toMatchObject(columnTotals(bench?.cards ?? []));
  });
});

describe('byPerson', () => {
  it('orders cards the way a column lists them: by name whatever the case, then by id', () => {
    const board = buildBoard({
      people: [person(3, 'zoe'), person(2, 'Bea'), person(1, 'bea'), person(4, 'Adam')],
      projects: [],
      entries: [],
      today: TODAY,
    });
    const cards = columnOf(board, 'col-bench')?.cards ?? [];
    expect(
      [...cards]
        .reverse()
        .sort(byPerson)
        .map((card) => card.key)
    ).toEqual(cards.map((card) => card.key));
  });

  it('puts a person’s cards together, by card number', () => {
    const senior = person(1, 'Senior');
    const board = buildBoard({
      people: [senior, person(2, 'Seniors')],
      projects: [apollo],
      entries: [
        onCard(3, senior, 3, apollo, '2026-06-03'),
        onCard(2, senior, 2, apollo, '2026-06-02'),
        entry(1, senior, apollo, '2026-03-12'),
      ],
      today: TODAY,
    });
    const cards = columnOf(board, 'col-10')?.cards ?? [];
    expect(
      [...cards]
        .reverse()
        .sort(byPerson)
        .map((card) => card.key)
    ).toEqual(['person-1-card-1', 'person-1-card-2', 'person-1-card-3']);
  });
});
