import type { PersonRow } from '@/features/people/schema';
import { PROJECT_STATUS_LABELS, type ProjectRow } from '@/features/projects/schema';
import type { AllocationRow } from './schema';

// The ledger answers "where is each of this person's cards on a day"; the board is that answer for today, worked out
// here from the ledger, the people and the projects. A card is a lane of the ledger: every entry belongs to one card of a
// person. Dates are `YYYY-MM-DD`, so comparing them as text compares them as days.

export interface BoardCard {
  /** `person-<personId>-card-<card>`. The prefix keeps a card's id from colliding with a column's in the Kanban component. */
  key: string;
  person: PersonRow;
  /** The card's number: the person's first card is 1, and a duplicate takes the next number the person has not had. */
  card: number;
  /** How many cards the person has on the board today, this one included. Their salary is split between them. */
  cardCount: number;
  /**
   * The project the card is on underneath, null for the bench. A card whose project is no longer active is shown on the
   * bench with a note, but keeps this: a copy of it starts on the same project.
   */
  projectId: number | null;
  /**
   * This card's share of the person's monthly salary, in whole INR paise: null when they have no salary on file. The
   * shares of a person's cards add up to the salary exactly (see `shareOf`).
   */
  salaryShare: number | null;
  /**
   * The date of the entry that put the card in this column. Null when it is on the bench with no entry yet, or because
   * the project of its last entry is no longer active: the note says which, and when it came off is not known.
   */
  since: string | null;
  /** "Last on Apollo (on hold)": set only on the bench, for a card whose project is no longer active. */
  note: string | null;
}

export interface BoardColumn {
  /** `col-bench` or `col-<projectId>`. */
  key: string;
  /** Null for the bench. */
  project: ProjectRow | null;
  cards: BoardCard[];
  /** What the cards in the column cost in a month, in whole INR paise: the sum of their salary shares. */
  monthlyCostPaise: number;
  /** How many of the cards in the column have no salary on file. */
  withoutSalary: number;
}

/** Joined (no join date, or on or before `today`) and not yet left (no leave date, or on or after `today`). */
export function isOnStaff(person: PersonRow, today: string): boolean {
  return (person.joinDate === '' || person.joinDate <= today) && (person.leaveDate === '' || person.leaveDate >= today);
}

/** A card of a person on a day: its number and the entry that places it, null for the implicit card 1. */
export interface PlacedCard {
  card: number;
  entry: AllocationRow | null;
}

/**
 * The cards a person has on `today`, by card number. For each card number take the person's latest entry dated on or
 * before the day (by date, then id: it reads the dates, not the order of the list, so an entry backfilled before a later
 * one changes nothing, and one dated in the future moves nobody yet). A card whose latest entry says it is removed is
 * gone, and a card with no entry on or before the day does not exist yet, except card 1, which is on the bench from the
 * start (its entry is null). When every card is removed, the implicit card 1 stands in, so a person on staff is never
 * missing from the board. The same rule is the service's, for the guards on removing a card.
 */
export function cardsOf(entries: readonly AllocationRow[], personId: number, today: string): PlacedCard[] {
  const latest = new Map<number, AllocationRow>();
  for (const entry of entries) {
    if (entry.personId !== personId || entry.effectiveDate > today) continue;
    const held = latest.get(entry.card);
    if (
      held === undefined ||
      entry.effectiveDate > held.effectiveDate ||
      (entry.effectiveDate === held.effectiveDate && entry.id > held.id)
    ) {
      latest.set(entry.card, entry);
    }
  }
  // Card 1 is there from the start; any other card is there once it has an entry.
  const placed: PlacedCard[] = [...latest.entries()]
    .filter(([, entry]) => !entry.removed)
    .map(([card, entry]) => ({ card, entry }));
  if (!latest.has(1)) placed.push({ card: 1, entry: null });
  placed.sort((a, b) => a.card - b.card);
  return placed.length > 0 ? placed : [{ card: 1, entry: null }];
}

/**
 * One card's share of a salary split between `cardCount` cards: every card gets the whole paise of salary / count, and
 * the paise left over go one each to the cards with the lowest numbers (`index` is the card's place in the person's
 * cards, from 0), so the shares add up to the salary exactly. Null for a person with no salary on file.
 */
export function shareOf(salaryPaise: number | null, cardCount: number, index: number): number | null {
  if (salaryPaise === null) return null;
  return Math.floor(salaryPaise / cardCount) + (index < salaryPaise % cardCount ? 1 : 0);
}

/**
 * What the cards cost in a month, in whole INR paise (the sum of their salary shares), and how many of them have no
 * salary on file (they add 0). A salary of zero is a salary. The board's heads read this from the cards a column holds
 * now, which a card being dragged changes before anything is saved.
 */
export function columnTotals(cards: readonly BoardCard[]): Pick<BoardColumn, 'monthlyCostPaise' | 'withoutSalary'> {
  let monthlyCostPaise = 0;
  let withoutSalary = 0;
  for (const { salaryShare } of cards) {
    if (salaryShare === null) withoutSalary += 1;
    else monthlyCostPaise += salaryShare;
  }
  return { monthlyCostPaise, withoutSalary };
}

/** By name, whatever the case, then by id. */
const byName =
  <T extends { id: number }>(name: (item: T) => string) =>
  (a: T, b: T) =>
    name(a).toLowerCase().localeCompare(name(b).toLowerCase()) || a.id - b.id;

/** The order of the cards in a column: by the person's name, then id, then card number. */
export const byPerson = (a: BoardCard, b: BoardCard) =>
  byName((person: PersonRow) => person.name)(a.person, b.person) || a.card - b.card;

/**
 * The board for `today`: the bench first, then a column for each active project, by name. A person is on it when they
 * are on staff, with a card for each of their cards (see `cardsOf`), each in the column of its project. A card on the
 * bench, or with no entry yet, is on the bench; so is one whose project is not active (on hold, completed) or no longer
 * exists, with a note naming it, so nobody vanishes from the board.
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
  const active = projects
    .filter((project) => project.projectStatus === 'active')
    .sort(byName((project) => project.name));
  for (const project of active) addColumn(`col-${project.id}`, project);

  for (const person of [...people].filter((row) => isOnStaff(row, today)).sort(byName((row) => row.name))) {
    const placed = cardsOf(entries, person.id, today);
    placed.forEach(({ card, entry }, index) => {
      let column = bench;
      let boardCard: BoardCard = {
        key: `person-${person.id}-card-${card}`,
        person,
        card,
        cardCount: placed.length,
        projectId: entry?.projectId ?? null,
        salaryShare: shareOf(person.monthlySalaryPaise, placed.length, index),
        since: entry?.effectiveDate ?? null,
        note: null,
      };

      if (entry?.project) {
        const target = columns.get(`col-${entry.project.id}`);
        if (target) {
          column = target;
        } else {
          // The project is not on the board: on hold or completed, or not in the list at all (deleted). The entry keeps
          // its name either way.
          const status = statusOf.get(entry.project.id);
          const label = status === undefined ? 'deleted' : PROJECT_STATUS_LABELS[status].toLowerCase();
          boardCard = { ...boardCard, since: null, note: `Last on ${entry.project.name} (${label})` };
        }
      }

      column.cards.push(boardCard);
    });
  }

  for (const column of columns.values()) {
    column.cards.sort(byPerson);
    Object.assign(column, columnTotals(column.cards));
  }
  return [...columns.values()];
}
