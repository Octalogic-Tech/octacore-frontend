import { z } from 'zod';
import { userRowSchema } from '@/lib/auth-schema';

/** The only role there is today. The service agrees: anything else is a 422 there too. */
export const ROLES = ['admin'] as const;

/**
 * The add and edit forms share a shape. A password is required when adding; when editing it is optional (blank
 * keeps the current one) but a given one must still be 10 to 128 characters. It is never trimmed: a space can be
 * part of it.
 */
export function userFormSchema(editing: boolean) {
  return z.object({
    name: z.string().trim().min(1, 'Name is required'),
    email: z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address')),
    role: z.enum(ROLES),
    password: editing
      ? z
          .string()
          .refine(
            (value) => value === '' || (value.length >= 10 && value.length <= 128),
            'Use 10 to 128 characters, or leave it blank to keep the current password',
          )
      : z.string().min(10, 'Use at least 10 characters').max(128, 'Use at most 128 characters'),
  });
}

export type UserFormValues = z.infer<ReturnType<typeof userFormSchema>>;

export const emptyUserForm: UserFormValues = { name: '', email: '', role: 'admin', password: '' };

export function toCreateBody(values: UserFormValues) {
  return { name: values.name, email: values.email, role: values.role, password: values.password };
}

/** PATCH changes only what is sent, so a blank password is left out and the current one stays. */
export function toUpdateBody(values: UserFormValues) {
  const { password, ...fields } = values;
  return password === '' ? fields : { ...fields, password };
}

export const userRowsSchema = z.array(userRowSchema);
