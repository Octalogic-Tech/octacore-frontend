import { personRowSchema, type PersonRow } from '@/features/people/schema';
import { projectRowSchema, type ProjectRow } from '@/features/projects/schema';
import { allocationRows } from '@/test/fixtures/allocations';
import { personRows } from '@/test/fixtures/people';
import { projectRows } from '@/test/fixtures/projects';
import { buildBoard, currentEntry, isOnStaff, type BoardColumn } from './board';
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

/** An entry: from `effectiveDate` the person is on the project, or on the bench when `on` is null. */
const entry = (id: number, who: PersonRow, on: { id: number; name: string } | null, effectiveDate: string): AllocationRow =>
  allocationRowSchema.parse({
    ...allocationRows[1],
    id,
    personId: who.id,
    projectId: on?.id ?? null,
    effectiveDate,
    note: null,
    person: { id: who.id, name: who.name },
    project: on ? { id: on.id, name: on.name } : null,
  });

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

describe('currentEntry', () => {
  it('is the latest entry on or before the day', () => {
    const entries = [
      entry(3, ada, apollo, '2026-09-01'),
      entry(2, ada, borealis, '2026-05-01'),
      entry(1, ada, null, '2026-01-01'),
    ];
    expect(currentEntry(entries, 1, TODAY)?.id).toBe(3);
    expect(currentEntry(entries, 1, '2026-08-31')?.id).toBe(2);
    expect(currentEntry(entries, 1, '2026-01-01')?.id).toBe(1);
  });

  it('counts an entry dated today, and not one dated tomorrow', () => {
    const entries = [entry(2, ada, apollo, '2026-10-20'), entry(1, ada, null, '2026-01-01')];
    expect(currentEntry(entries, 1, TODAY)?.id).toBe(2);
    expect(currentEntry(entries, 1, '2026-10-19')?.id).toBe(1);
  });

  it('is null when the person has no entry yet, or only entries that start later', () => {
    expect(currentEntry([], 1, TODAY)).toBeNull();
    expect(currentEntry([entry(1, grace, apollo, '2026-01-01')], 1, TODAY)).toBeNull();
    expect(currentEntry([entry(1, ada, apollo, '2026-10-21')], 1, TODAY)).toBeNull();
  });

  it('does not depend on the order of the list', () => {
    const entries = [
      entry(2, ada, borealis, '2026-05-01'),
      entry(3, ada, apollo, '2026-09-01'),
      entry(1, ada, null, '2026-01-01'),
    ];
    expect(currentEntry(entries, 1, TODAY)?.id).toBe(3);
    expect(currentEntry([...entries].reverse(), 1, TODAY)?.id).toBe(3);
  });

  it('keeps an entry backfilled before a later one from changing where the person is now', () => {
    // Entered last (id 9) but dated earliest: the person is still on Apollo.
    const entries = [entry(2, ada, apollo, '2026-03-12'), entry(9, ada, null, '2026-01-05')];
    expect(currentEntry(entries, 1, TODAY)?.id).toBe(2);
  });

  it('makes the previous entry current once the current one is gone from the list', () => {
    const entries = [entry(2, ada, apollo, '2026-03-12'), entry(1, ada, borealis, '2026-01-05')];
    expect(currentEntry(entries, 1, TODAY)?.id).toBe(2);
    // The service no longer lists a deleted entry.
    expect(currentEntry(entries.filter((row) => row.id !== 2), 1, TODAY)?.id).toBe(1);
  });

  it('does not move anyone for an entry dated in the future', () => {
    const entries = [entry(2, ada, borealis, '2027-01-01'), entry(1, ada, apollo, '2026-03-12')];
    expect(currentEntry(entries, 1, TODAY)?.id).toBe(1);
  });

  it('reads only the person asked about', () => {
    const entries = [entry(2, grace, borealis, '2026-09-01'), entry(1, ada, apollo, '2026-03-12')];
    expect(currentEntry(entries, 1, TODAY)?.id).toBe(1);
    expect(currentEntry(entries, 2, TODAY)?.id).toBe(2);
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
    expect(board.map((column) => column.project?.name ?? null)).toEqual([null, 'Apollo', 'Apollo 2', 'Borealis', 'zephyr']);
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
      key: 'person-1',
      person: ada,
      since: '2026-03-12',
      note: null,
    });
    expect(names(columnOf(board, 'col-bench'))).toEqual([]);
    expect(names(columnOf(board, 'col-11'))).toEqual([]);
  });

  it('puts a person with no entry on the bench, with no date and no note', () => {
    const board = buildBoard({ people: [ada], projects: [apollo], entries: [], today: TODAY });
    expect(columnOf(board, 'col-bench')?.cards).toEqual([{ key: 'person-1', person: ada, since: null, note: null }]);
  });

  it('puts a person whose latest entry is the bench on the bench, since that day, and with no note', () => {
    const board = buildBoard({
      people: [ada],
      projects: [apollo],
      entries: [entry(2, ada, null, '2026-09-01'), entry(1, ada, apollo, '2026-03-12')],
      today: TODAY,
    });
    expect(columnOf(board, 'col-bench')?.cards).toEqual([
      { key: 'person-1', person: ada, since: '2026-09-01', note: null },
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
    expect(columnOf(board, 'col-bench')?.cards).toEqual([{ key: 'person-1', person: ada, since: null, note }]);
  });

  it('puts the people of a project that is not in the list at all (deleted) on the bench, and says so', () => {
    const board = buildBoard({
      people: [ada],
      projects: [borealis],
      entries: [entry(1, ada, apollo, '2026-03-12')],
      today: TODAY,
    });
    expect(columnOf(board, 'col-bench')?.cards).toEqual([
      { key: 'person-1', person: ada, since: null, note: 'Last on Apollo (deleted)' },
    ]);
  });

  it('reads the name from the entry, which keeps it when the project is deleted', () => {
    const gone = { id: 99, name: 'Old name kept in the ledger' };
    const board = buildBoard({ people: [ada], projects: [], entries: [entry(1, ada, gone, '2026-03-12')], today: TODAY });
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
      people: [person(1, 'Ada', { monthlySalaryPaise: 8_500_000 }), person(2, 'Grace', { monthlySalaryPaise: 11_500_000 })],
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
      entries: [entry(1, ada, apollo, '2026-03-12'), entry(2, linus, apollo, '2026-03-12'), entry(3, person(4, 'Mary'), apollo, '2026-03-12')],
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
      'person-4',
      'person-1',
      'person-2',
      'person-3',
    ]);
  });

  it('keys columns and cards apart, so the two kinds of id cannot collide', () => {
    const board = buildBoard({
      people: [person(10, 'Ada')],
      projects: [apollo],
      entries: [entry(1, person(10, 'Ada'), apollo, '2026-03-12')],
      today: TODAY,
    });
    const keys = [...board.map((column) => column.key), ...board.flatMap((column) => column.cards.map((card) => card.key))];
    expect(keys).toEqual(['col-bench', 'col-10', 'person-10']);
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
