import { z } from 'zod';
import { amountProblem, parseAmount, toAmountText } from '@/lib/money';

const nullToEmpty = (text: string | null) => text ?? '';
const orNull = (text: string) => (text === '' ? null : text);

// Only what the pages use. The service also sends `status` and the created, updated and deleted dates; unknown keys
// are dropped. A person saved with only a name comes back with null for every optional field, which the pages treat
// as empty, except the salary: null there means none is on file, and 0 is a salary of zero.
export const personRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  joinDate: z.string().nullable().transform(nullToEmpty),
  leaveDate: z.string().nullable().transform(nullToEmpty),
  email: z.string().nullable().transform(nullToEmpty),
  phone: z.string().nullable().transform(nullToEmpty),
  imageLink: z.string().nullable().transform(nullToEmpty),
  contractLink: z.string().nullable().transform(nullToEmpty),
  // Whole US cents per month.
  monthlySalaryCents: z.number().int().nullable(),
});

export const personRowsSchema = z.array(personRowSchema);

export type PersonRow = z.output<typeof personRowSchema>;

// Every field is text, so a blank field can be told from a typed one. The dates are what a date input holds:
// `YYYY-MM-DD`, or '' when empty.
export const personFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    email: z.string().trim(),
    phone: z.string().trim(),
    joinDate: z.string(),
    leaveDate: z.string(),
    imageLink: z.string().trim(),
    contractLink: z.string().trim(),
    // Dollars and cents, as text, not a number input: a comma or a currency sign must be told what is wrong, not
    // dropped. Empty means none on file.
    monthlySalary: z.string().trim(),
  })
  .superRefine((values, context) => {
    if (values.email !== '' && !z.email().safeParse(values.email).success) {
      context.addIssue({ code: 'custom', path: ['email'], message: 'Enter a valid email address' });
    }
    if (values.monthlySalary === '') return;
    const problem = amountProblem(values.monthlySalary, { allowZero: true });
    if (problem !== null) context.addIssue({ code: 'custom', path: ['monthlySalary'], message: problem });
  });

export type PersonFormValues = z.infer<typeof personFormSchema>;

export const emptyPersonForm: PersonFormValues = {
  name: '',
  email: '',
  phone: '',
  joinDate: '',
  leaveDate: '',
  imageLink: '',
  contractLink: '',
  monthlySalary: '',
};

export function toFormValues(person?: PersonRow): PersonFormValues {
  if (!person) return emptyPersonForm;
  return {
    name: person.name,
    email: person.email,
    phone: person.phone,
    joinDate: person.joinDate,
    leaveDate: person.leaveDate,
    imageLink: person.imageLink,
    contractLink: person.contractLink,
    monthlySalary: person.monthlySalaryCents === null ? '' : toAmountText(person.monthlySalaryCents),
  };
}

export interface PersonBody {
  name: string;
  email: string | null;
  phone: string | null;
  joinDate: string | null;
  leaveDate: string | null;
  imageLink: string | null;
  contractLink: string | null;
  /** Whole US cents; the form holds dollars and cents. */
  monthlySalaryCents: number | null;
}

/** Empty optional fields go as null: PATCH changes only what it is sent, and null clears. */
export function toPersonBody(values: PersonFormValues): PersonBody {
  return {
    name: values.name,
    email: orNull(values.email),
    phone: orNull(values.phone),
    joinDate: orNull(values.joinDate),
    leaveDate: orNull(values.leaveDate),
    imageLink: orNull(values.imageLink),
    contractLink: orNull(values.contractLink),
    monthlySalaryCents: values.monthlySalary === '' ? null : parseAmount(values.monthlySalary),
  };
}
