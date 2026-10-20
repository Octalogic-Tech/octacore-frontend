import { z } from 'zod';
import { localToday } from '@/lib/format';

const nullToEmpty = (text: string | null) => text ?? '';
const orNull = (text: string) => (text === '' ? null : text);

/** The project select's value for the bench: an entry with no project. */
export const BENCH = 'bench';
/** The project select's last option: the entry says the card is gone from its date. It has no project. */
export const REMOVED = 'removed';
/** The card select's last option when adding: a card the person does not have yet, which the service numbers. */
export const NEW_CARD = 'new';

// Only what the pages use. The service also sends `status` and the created, updated and deleted dates; unknown keys
// are dropped. An entry says "from this date this person's card N is on this project": a null project is the bench,
// and `removed` says the card is gone from that date (a removed entry has no project). A person has card 1 from the
// start and may have more, each its own lane of the ledger. The project keeps its name when it was deleted later, so a
// ledger stays readable; a deleted person's entries are gone. A note saved without text comes back null, which the
// pages treat as empty. The date is checked as a real day because the board compares dates as text.
export const allocationRowSchema = z.object({
  id: z.number().int(),
  personId: z.number().int(),
  card: z.number().int().min(1),
  removed: z.boolean(),
  projectId: z.number().int().nullable(),
  effectiveDate: z.iso.date(),
  note: z.string().nullable().transform(nullToEmpty),
  person: z.object({ id: z.number().int(), name: z.string() }),
  project: z.object({ id: z.number().int(), name: z.string() }).nullable(),
});

export const allocationRowsSchema = z.array(allocationRowSchema);

export type AllocationRow = z.output<typeof allocationRowSchema>;

/** What the Project column of the ledger says: the project, the bench, or that the card was removed. */
export const entryPlace = (row: Pick<AllocationRow, 'project' | 'removed'>) =>
  row.removed ? 'Card removed' : (row.project?.name ?? 'Bench');

/**
 * The ledger's search: the text is in the person's name, in the card ("Card 2"), or in what the Project column says
 * (the project's name, "Bench", or "Card removed").
 */
export function allocationMatches(row: AllocationRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [row.person.name, `Card ${row.card}`, entryPlace(row)].some((text) => text.toLowerCase().includes(needle));
}

/**
 * The card numbers a person has an entry for (removed cards too: an entry can still be added to one), once each and in
 * order, with card 1 always: every person has it. What the entry form's Card field offers, besides a new card.
 */
export function cardChoices(entries: readonly Pick<AllocationRow, 'card'>[]): number[] {
  return [...new Set([1, ...entries.map((entry) => entry.card)])].sort((a, b) => a - b);
}

// Every field is text, so a blank field can be told from a typed one: `personId` is '' until one is chosen, `card` is
// a card number or `NEW_CARD`, `projectId` is `BENCH`, `REMOVED` or the id, and the date is what a date input holds,
// `YYYY-MM-DD`.
export const allocationFormSchema = z
  .object({
    personId: z.string().min(1, 'Choose a person'),
    card: z.string().refine((value) => value === NEW_CARD || /^[1-9]\d*$/.test(value), 'Choose a card'),
    projectId: z
      .string()
      .refine(
        (value) => value === BENCH || value === REMOVED || /^[1-9]\d*$/.test(value),
        'Choose a project or the bench',
      ),
    effectiveDate: z.string().min(1, 'Effective date is required'),
    note: z.string().trim(),
  })
  .superRefine((values, context) => {
    if (values.card === NEW_CARD && values.projectId === REMOVED) {
      context.addIssue({ code: 'custom', path: ['projectId'], message: 'A new card cannot be removed' });
    }
  });

export type AllocationFormValues = z.infer<typeof allocationFormSchema>;

/**
 * A new entry opens dated today (the browser's local day) on card 1 and the bench option, with nobody chosen; an edit
 * opens on the entry.
 */
export function toAllocationFormValues(row?: AllocationRow): AllocationFormValues {
  if (!row) return { personId: '', card: '1', projectId: BENCH, effectiveDate: localToday(), note: '' };
  return {
    personId: String(row.personId),
    card: String(row.card),
    projectId: row.removed ? REMOVED : row.projectId === null ? BENCH : String(row.projectId),
    effectiveDate: row.effectiveDate,
    note: row.note,
  };
}

export interface AllocationBody {
  personId: number;
  /** The card the entry is for. Null is a new card, which is added through the cards endpoint, not as an entry. */
  card: number | null;
  /** Null is the bench (or, with `removed`, no project at all). */
  projectId: number | null;
  /** The entry says the card is gone from its date. */
  removed: boolean;
  effectiveDate: string;
  /** Empty goes as null, which clears the note of an entry being edited. */
  note: string | null;
}

export function toAllocationBody(values: AllocationFormValues): AllocationBody {
  const noProject = values.projectId === BENCH || values.projectId === REMOVED;
  return {
    personId: Number(values.personId),
    card: values.card === NEW_CARD ? null : Number(values.card),
    projectId: noProject ? null : Number(values.projectId),
    removed: values.projectId === REMOVED,
    effectiveDate: values.effectiveDate,
    note: orNull(values.note),
  };
}
