import { z } from 'zod';

// What the service sends for a user. It never sends a password or a hash; the audit fields are `status` and
// `deletedDate`, which the app does not use, so unknown keys are dropped.
export const userRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  lastLoginDate: z.string().nullable(),
  createdDate: z.string(),
  updatedDate: z.string(),
});

export type UserRow = z.infer<typeof userRowSchema>;

/** The data of a login, refresh or change-password answer. */
export const authSessionSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int(),
  user: userRowSchema,
});

export type AuthSession = z.infer<typeof authSessionSchema>;
