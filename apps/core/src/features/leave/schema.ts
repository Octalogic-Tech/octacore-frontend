import { z } from 'zod';
import { formatDate } from '@/lib/format';

const nullToEmpty = (text: string | null) => text ?? '';
const orNull = (text: string) => (text === '' ? null : text);

export const leaveTypeSchema = z.enum(['casual', 'sick', 'earned', 'unpaid', 'other']);

export type LeaveType = z.infer<typeof leaveTypeSchema>;

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  casual: 'Casual',
  sick: 'Sick',
  earned: 'Earned',
  unpaid: 'Unpaid',
  other: 'Other',
};

/** The types a leave can be, in the order the form offers them. */
export const LEAVE_TYPES = leaveTypeSchema.options.map((value) => ({ value, label: LEAVE_TYPE_LABELS[value] }));

// Only what the pages use. The service also sends `status` and the created, updated and deleted dates; unknown keys
// are dropped. A leave is a type and a first and a last day, both counted: one day has the same date in both. A reason
// saved without text comes back null, which the pages treat as empty. The dates are checked as real days, which is
// also what lets them be compared as text. A deleted person's leaves are gone.
export const leaveRowSchema = z.object({
  id: z.number().int(),
  personId: z.number().int(),
  person: z.object({ id: z.number().int(), name: z.string() }),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  leaveType: leaveTypeSchema,
  reason: z.string().nullable().transform(nullToEmpty),
});

export const leaveRowsSchema = z.array(leaveRowSchema);

export type LeaveRow = z.output<typeof leaveRowSchema>;

/** A range as the first day to the last ("12 Mar 2026 to 14 Mar 2026"), and one date for a single day. */
export function leaveDates({ startDate, endDate }: Pick<LeaveRow, 'startDate' | 'endDate'>): string {
  return startDate === endDate ? formatDate(startDate) : `${formatDate(startDate)} to ${formatDate(endDate)}`;
}

/** The register's search: the text is in the person's name, the type (its label, or the word the service uses) or the reason. */
export function leaveMatches(row: LeaveRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [row.person.name, LEAVE_TYPE_LABELS[row.leaveType], row.leaveType, row.reason].some((text) =>
    text.toLowerCase().includes(needle)
  );
}

// Every field is text, so a blank field can be told from a typed one: `personId` and `leaveType` are '' until chosen,
// and the days are what a date input holds, `YYYY-MM-DD`, or ''.
export const leaveFormSchema = z
  .object({
    personId: z.string().min(1, 'Choose a person'),
    leaveType: z.string().refine((value) => leaveTypeSchema.safeParse(value).success, 'Choose a type'),
    startDate: z.string().min(1, 'First day is required'),
    endDate: z.string().min(1, 'Last day is required'),
    reason: z.string().trim(),
  })
  .superRefine((values, context) => {
    if (values.startDate !== '' && values.endDate !== '' && values.endDate < values.startDate) {
      context.addIssue({ code: 'custom', path: ['endDate'], message: 'The last day must not be before the first' });
    }
  });

export type LeaveFormValues = z.infer<typeof leaveFormSchema>;

/** A new leave opens with nothing chosen and no days: a wrong default would be saved as if it were meant. */
export function toLeaveFormValues(row?: LeaveRow): LeaveFormValues {
  if (!row) return { personId: '', leaveType: '', startDate: '', endDate: '', reason: '' };
  return {
    personId: String(row.personId),
    leaveType: row.leaveType,
    startDate: row.startDate,
    endDate: row.endDate,
    reason: row.reason,
  };
}

export interface LeaveBody {
  personId: number;
  startDate: string;
  endDate: string;
  leaveType: LeaveType;
  /** Empty goes as null, which clears the reason of a leave being edited. */
  reason: string | null;
}

/** Call it once `leaveFormSchema` has passed: the type is then one of the five. */
export function toLeaveBody(values: LeaveFormValues): LeaveBody {
  return {
    personId: Number(values.personId),
    startDate: values.startDate,
    endDate: values.endDate,
    leaveType: values.leaveType as LeaveType,
    reason: orNull(values.reason),
  };
}
