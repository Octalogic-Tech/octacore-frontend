import { z } from 'zod';

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().trim().min(1, 'Description is required'),
});

export type CategoryInput = z.infer<typeof categorySchema>;
