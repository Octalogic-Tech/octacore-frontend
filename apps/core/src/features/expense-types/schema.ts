import { z } from 'zod';

export const expenseTypeFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().trim(),
});

export type ExpenseTypeFormValues = z.infer<typeof expenseTypeFormSchema>;

export const emptyExpenseTypeForm: ExpenseTypeFormValues = { name: '', description: '' };

// Only what the page uses. The service also sends `status` and `deletedDate`; unknown keys are dropped. A type saved
// without a description comes back with null, which the page treats as an empty one.
export const expenseTypeRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable().transform((text) => text ?? ''),
  createdDate: z.string(),
  updatedDate: z.string(),
});

export const expenseTypeRowsSchema = z.array(expenseTypeRowSchema);

export type ExpenseTypeRow = z.output<typeof expenseTypeRowSchema>;

export interface ExpenseTypeBody {
  name: string;
  description: string | null;
}

/** An empty description goes as null: PATCH changes only what it is sent, and null clears. */
export function toExpenseTypeBody(values: ExpenseTypeFormValues): ExpenseTypeBody {
  return { name: values.name, description: values.description === '' ? null : values.description };
}
