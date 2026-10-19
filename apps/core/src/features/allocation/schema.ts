import { z } from 'zod';
import { localToday } from '@/lib/format';

const nullToEmpty = (text: string | null) => text ?? '';
const orNull = (text: string) => (text === '' ? null : text);

/** The project select's value for the bench: an entry with no project. */
export const BENCH = 'bench';

// Only what the pages use. The service also sends `status` and the created, updated and deleted dates; unknown keys
// are dropped. An entry says "from this date this person is on this project": a null project is the bench. The project
// keeps its name when it was deleted later, so a ledger stays readable; a deleted person's entries are gone. A note
// saved without text comes back null, which the pages treat as empty. The date is checked as a real day because the
// board compares dates as text.
export const allocationRowSchema = z.object({
  id: z.number().int(),
  personId: z.number().int(),
  projectId: z.number().int().nullable(),
  effectiveDate: z.iso.date(),
  note: z.string().nullable().transform(nullToEmpty),
  person: z.object({ id: z.number().int(), name: z.string() }),
  project: z.object({ id: z.number().int(), name: z.string() }).nullable(),
});

export const allocationRowsSchema = z.array(allocationRowSchema);

export type AllocationRow = z.output<typeof allocationRowSchema>;

// Every field is text, so a blank field can be told from a typed one: `personId` is '' until one is chosen, `projectId`
// is `BENCH` or the id, and the date is what a date input holds, `YYYY-MM-DD`.
export const allocationFormSchema = z.object({
  personId: z.string().min(1, 'Choose a person'),
  projectId: z.string().refine((value) => value === BENCH || /^[1-9]\d*$/.test(value), 'Choose a project or the bench'),
  effectiveDate: z.string().min(1, 'Effective date is required'),
  note: z.string().trim(),
});

export type AllocationFormValues = z.infer<typeof allocationFormSchema>;

/** A new entry opens dated today (the browser's local day) on the bench option, with nobody chosen; an edit opens on the entry. */
export function toAllocationFormValues(row?: AllocationRow): AllocationFormValues {
  if (!row) return { personId: '', projectId: BENCH, effectiveDate: localToday(), note: '' };
  return {
    personId: String(row.personId),
    projectId: row.projectId === null ? BENCH : String(row.projectId),
    effectiveDate: row.effectiveDate,
    note: row.note,
  };
}

export interface AllocationBody {
  personId: number;
  /** Null is the bench. */
  projectId: number | null;
  effectiveDate: string;
  /** Empty goes as null, which clears the note of an entry being edited. */
  note: string | null;
}

export function toAllocationBody(values: AllocationFormValues): AllocationBody {
  return {
    personId: Number(values.personId),
    projectId: values.projectId === BENCH ? null : Number(values.projectId),
    effectiveDate: values.effectiveDate,
    note: orNull(values.note),
  };
}
