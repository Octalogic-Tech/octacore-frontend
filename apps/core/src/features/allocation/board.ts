import type { PersonRow } from '@/features/people/schema';
import { PROJECT_STATUS_LABELS, type ProjectRow } from '@/features/projects/schema';
import type { AllocationRow } from './schema';

// The ledger answers "where is this person on a day"; the board is that answer for today, worked out here from the
// ledger, the people and the projects. Dates are `YYYY-MM-DD`, so comparing them as text compares them as days.

export interface BoardCard {
  /** `person-<id>`. The prefix keeps a card's id from colliding with a column's in the Kanban component. */
  key: string;
  person: PersonRow;
  /**
   * The date of the entry that put the person in this column. Null when they are on the bench with no entry yet, or
   * because the project of their last entry is no longer active: the note says which, and when they came off it is
   * not known.
   */
  since: string | null;
  /** "Last on Apollo (on hold)": set only on the bench, for a person whose last project is no longer active. */
  note: string | null;
}

export interface BoardColumn {
  /** `col-bench` or `col-<projectId>`. */
  key: string;
  /** Null for the bench. */
  project: ProjectRow | null;
  cards: BoardCard[];
  /** What the people in the column are paid in a month, in whole INR paise; a person with no salary adds 0. */
  monthlyCostPaise: number;
  /** How many of the people in the column have no salary on file. */
  withoutSalary: number;
}

/** Joined (no join date, or on or before `today`) and not yet left (no leave date, or on or after `today`). */
export function isOnStaff(person: PersonRow, today: string): boolean {
  return (person.joinDate === '' || person.joinDate <= today) && (person.leaveDate === '' || person.leaveDate >= today);
}

/**
 * Where the person is on `today`: their latest entry dated on or before it, or null when they have none. It reads the
 * dates, not the order of the list, so an entry backfilled before a later one does not change the answer, and one
 * dated in the future does not move anyone yet. Two entries on one day cannot exist (the service allows one a day);
 * should they, the later entered one counts.
 */
export function currentEntry(entries: readonly AllocationRow[], personId: number, today: string): AllocationRow | null {
  let current: AllocationRow | null = null;
  for (const entry of entries) {
    if (entry.personId !== personId || entry.effectiveDate > today) continue;
    if (
      current === null ||
      entry.effectiveDate > current.effectiveDate ||
      (entry.effectiveDate === current.effectiveDate && entry.id > current.id)
    ) {
      current = entry;
    }
  }
  return current;
}

/** By name, whatever the case, then by id. */
const byName = <T extends { id: number }>(name: (item: T) => string) => (a: T, b: T) =>
  name(a).toLowerCase().localeCompare(name(b).toLowerCase()) || a.id - b.id;

/**
 * The board for `today`: the bench first, then a column for each active project, by name. A person is on it when they
 * are on staff, in the column of the project of their current entry. A person with no entry, or whose entry is the
 * bench, is on the bench; so is one whose project is not active (on hold, completed) or no longer exists, with a note
 * naming it, so nobody vanishes from the board.
 */
export function buildBoard({
  people,
  projects,
  entries,
  today,
}: {
  people: readonly PersonRow[];
  projects: readonly ProjectRow[];
  entries: readonly AllocationRow[];
  today: string;
}): BoardColumn[] {
  const statusOf = new Map(projects.map((project) => [project.id, project.projectStatus]));
  const columns = new Map<string, BoardColumn>();
  const addColumn = (key: string, project: ProjectRow | null) => {
    const column: BoardColumn = { key, project, cards: [], monthlyCostPaise: 0, withoutSalary: 0 };
    columns.set(key, column);
    return column;
  };

  const bench = addColumn('col-bench', null);
  const active = projects.filter((project) => project.projectStatus === 'active').sort(byName((project) => project.name));
  for (const project of active) addColumn(`col-${project.id}`, project);

  for (const person of [...people].filter((row) => isOnStaff(row, today)).sort(byName((row) => row.name))) {
    const entry = currentEntry(entries, person.id, today);
    let column = bench;
    let card: BoardCard = { key: `person-${person.id}`, person, since: entry?.effectiveDate ?? null, note: null };

    if (entry?.project) {
      const target = columns.get(`col-${entry.project.id}`);
      if (target) {
        column = target;
      } else {
        // The project is not on the board: on hold or completed, or not in the list at all (deleted). The entry keeps
        // its name either way.
        const status = statusOf.get(entry.project.id);
        const label = status === undefined ? 'deleted' : PROJECT_STATUS_LABELS[status].toLowerCase();
        card = { ...card, since: null, note: `Last on ${entry.project.name} (${label})` };
      }
    }

    column.cards.push(card);
    if (person.monthlySalaryPaise === null) column.withoutSalary += 1;
    else column.monthlyCostPaise += person.monthlySalaryPaise;
  }

  return [...columns.values()];
}
