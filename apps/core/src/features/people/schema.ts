import { z } from 'zod';

// Only what the resource form uses. The service also sends the person's dates, email, phone and links; unknown keys
// are dropped.
export const personRowSchema = z.object({ id: z.number().int(), name: z.string() });

export const personRowsSchema = z.array(personRowSchema);

export type PersonRow = z.output<typeof personRowSchema>;
