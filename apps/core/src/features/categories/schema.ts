import { z } from 'zod';

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().trim().min(1, 'Description is required'),
});

export type CategoryInput = z.infer<typeof categorySchema>;

// Only what the page uses. The service also sends `status` and `deletedDate`; unknown keys are dropped.
// A category saved without a description comes back with null, which the page treats as an empty one.
export const categoryRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable().transform((text) => text ?? ''),
  createdDate: z.string(),
  updatedDate: z.string(),
});

export const categoryRowsSchema = z.array(categoryRowSchema);
