import { buildBoard, isOnStaff } from '@/features/allocation/board';
import type { AllocationRow } from '@/features/allocation/schema';
import type { ProjectRow } from '@/features/projects/schema';
import type { PersonRow } from './schema';

/** Where one of several cards is: on a project (null for the bench), since a date, or on the bench with a note. */
export interface CardPlacement {
  card: number;
  /** Null on the bench, which includes a card whose project is no longer active (the note says which). */
  project: { id: number; name: string } | null;
  since: string | null;
  note: string | null;
}

/** Where a person is today, as the person's page says it. */
export type Placement =
  /** One card, on a project, since its date. */
  | { kind: 'project'; project: { id: number; name: string }; since: string }
  /** One card, on the bench: by an entry, since its date, or because its project is not active, with a note. */
  | { kind: 'bench'; since: string | null; note: string | null }
  /** One card, on the bench with no entry yet (or only entries that start later). */
  | { kind: 'unallocated' }
  /** More than one card: where each is, the lowest card number first. */
  | { kind: 'several'; cards: CardPlacement[] }
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

  const cards = buildBoard({ people: [person], projects, entries, today })
    .flatMap((column) => column.cards.map((card) => ({ column, card })))
    .sort((a, b) => a.card.card - b.card.card);
  const placed: CardPlacement[] = cards.map(({ column, card }) => ({
    card: card.card,
    project: column.project ? { id: column.project.id, name: column.project.name } : null,
    since: card.since,
    note: card.note,
  }));
  if (placed.length === 0) return { kind: 'unallocated' };
  if (placed.length > 1) return { kind: 'several', cards: placed };

  const [only] = placed;
  if (only.project) return { kind: 'project', project: only.project, since: only.since ?? '' };
  if (only.note !== null) return { kind: 'bench', since: null, note: only.note };
  // Bench with no note and no date: nothing has put the card anywhere yet.
  return only.since === null ? { kind: 'unallocated' } : { kind: 'bench', since: only.since, note: null };
}
