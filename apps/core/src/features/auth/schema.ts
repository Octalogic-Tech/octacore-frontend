import { z } from 'zod';

// The email is not checked as an address: the service answers an unknown account with the same message as a
// wrong password. The password is used exactly as typed (no trim): a space can be part of it.
export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
