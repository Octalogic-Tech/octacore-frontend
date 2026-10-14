import { z } from 'zod';

export const technologySchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  category: z.string().trim(),
  description: z.string().trim().min(1, 'Description is required'),
});

export type TechnologyInput = z.infer<typeof technologySchema>;
