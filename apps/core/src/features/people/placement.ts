import { buildBoard, isOnStaff } from '@/features/allocation/board';
import type { AllocationRow } from '@/features/allocation/schema';
import type { ProjectRow } from '@/features/projects/schema';
import type { PersonRow } from './schema';

/** Where a person is today, as the person's page says it. */
export type Placement =
  /** On the project of their latest entry, since its date. */
  | { kind: 'project'; project: { id: number; name: string }; since: string }
  /** On the bench: by an entry, since its date, or because their last project is no longer active, with a note. */
  | { kind: 'bench'; since: string | null; note: string | null }
  /** On the bench with no entry yet (or only entries that start later). */
  | { kind: 'unallocated' }
  /** Not on the board: gone before today. */
  | { kind: 'left'; date: string }
  /** Not on the board: not here until after today. */
  | { kind: 'not-joined'; date: string };

/**
 * Where the person is today. It is the board's answer for them, from the same function, so the page and the board
 * cannot disagree; what the board cannot say (no card) is why they are not on it.
 */
export function placementOf({
  person,
  projects,
  entries,
  today,
}: {
  person: PersonRow;
  projects: readonly ProjectRow[];
  entries: readonly AllocationRow[];
  today: string;
}): Placement {
  if (!isOnStaff(person, today)) {
    return person.joinDate > today
      ? { kind: 'not-joined', date: person.joinDate }
      : { kind: 'left', date: person.leaveDate };
  }

  const column = buildBoard({ people: [person], projects, entries, today }).find(
    (candidate) => candidate.cards.length > 0
  );
  const card = column?.cards[0];
  if (!column || !card) return { kind: 'unallocated' };
  if (column.project) {
    return { kind: 'project', project: { id: column.project.id, name: column.project.name }, since: card.since ?? '' };
  }
  if (card.note !== null) return { kind: 'bench', since: null, note: card.note };
  // Bench with no note and no date: nothing has put them anywhere yet.
  return card.since === null ? { kind: 'unallocated' } : { kind: 'bench', since: card.since, note: null };
}
