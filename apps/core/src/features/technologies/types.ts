import type { z } from 'zod';
import type { technologyRowSchema } from './schema';

export type Technology = z.infer<typeof technologyRowSchema>;
