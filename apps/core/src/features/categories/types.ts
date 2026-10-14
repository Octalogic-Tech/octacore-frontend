import type { z } from 'zod';
import type { categoryRowSchema } from './schema';

export type Category = z.infer<typeof categoryRowSchema>;
