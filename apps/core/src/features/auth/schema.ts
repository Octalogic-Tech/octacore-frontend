import { z } from 'zod';

// The email is not checked as an address: the service answers an unknown account with the same message as a
// wrong password. The password is used exactly as typed (no trim): a space can be part of it. 128 characters is the
// service's limit; it refuses anything longer.
export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required').max(128, 'Use at most 128 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// 10 to 128 characters, the service's own limits, so what it would refuse is caught before the request.
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(10, 'Use at least 10 characters').max(128, 'Use at most 128 characters'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The passwords do not match',
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
