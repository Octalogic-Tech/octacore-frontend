import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/features/auth/auth-context';
import { refreshSession, serviceMessage, statusOf } from '@/lib/core-api';
import { useCreateUser, useUpdateUser } from './api';
import { emptyUserForm, ROLES, userFormSchema, type UserFormValues } from './schema';
import type { User } from './types';

const GENERIC_FAILURE = 'That did not save. Try again.';

/**
 * What to tell the person when a save fails. A 409 or 422 carries the service's own message, which is shown, except
 * the two generic ones that read like a database or a framework talking: a unique-index clash (the email, the only
 * unique field a user has) and the request-validation catch-all.
 */
function failureMessage(error: unknown): string {
  const status = statusOf(error);
  const message = serviceMessage(error);
  if (status === 409 && message === 'A record with the same unique value already exists') {
    return 'A user with that email already exists';
  }
  if (status === 422 && message === 'Validation failed') return GENERIC_FAILURE;
  return message ?? GENERIC_FAILURE;
}

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing, absent when adding. */
  user?: User;
}

export function UserFormDialog({ open, onOpenChange, user }: UserFormDialogProps) {
  const create = useCreateUser();
  const update = useUpdateUser();
  const { user: me } = useAuth();
  const [failure, setFailure] = useState<string | null>(null);
  const editing = user !== undefined;
  // Your own password changes through Change password, which asks for the current one; the service refuses it here.
  const ownRow = editing && user.id === me?.id;
  // A password is required when adding and optional when editing, so the schema depends on which this is.
  const resolver = useMemo(() => zodResolver(userFormSchema(editing)), [editing]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({ resolver, defaultValues: emptyUserForm });

  useEffect(() => {
    if (open) {
      // The cast is safe only while ROLES is ['admin'], the one role the service has: widen it when roles are added.
      reset(user ? { name: user.name, email: user.email, role: user.role as UserFormValues['role'], password: '' } : emptyUserForm);
      setFailure(null);
    }
  }, [open, user, reset]);

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      if (user) await update.mutateAsync({ id: user.id, values });
      else await create.mutateAsync(values);
      onOpenChange(false);
      // The sidebar shows your name and email from the session: a refresh brings the new ones (AuthProvider hears
      // whose session it is). If it fails, the old details stay on screen until the next refresh.
      if (ownRow) refreshSession().catch(() => undefined);
    } catch (error) {
      setFailure(failureMessage(error));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Not while saving: a failure would land on a closed dialog and be lost.
        if (!isSubmitting) onOpenChange(next);
      }}
    >
      <DialogContent fallbackFocusId="user-search">
        <DialogTitle>{editing ? 'Edit user' : 'New user'}</DialogTitle>
        <DialogDescription>
          {ownRow
            ? 'Change your name, email or role.'
            : editing
            ? 'Change their details, or set a new password to replace the current one.'
            : 'Name the person, give them the email they will sign in with, and set a password.'}
        </DialogDescription>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
          <Field label="Name" htmlFor="user-name" error={errors.name?.message}>
            <Input {...fieldA11y('user-name', errors.name?.message)} {...register('name')} autoComplete="off" />
          </Field>
          <Field label="Email" htmlFor="user-email" error={errors.email?.message}>
            <Input
              {...fieldA11y('user-email', errors.email?.message)}
              {...register('email')}
              type="email"
              autoComplete="off"
            />
          </Field>
          <Field label="Role" htmlFor="user-role" error={errors.role?.message}>
            <Select {...fieldA11y('user-role', errors.role?.message)} {...register('role')}>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
          </Field>
          {ownRow ? (
            <p className="text-small text-navy-72">Use Change password to change your own password.</p>
          ) : (
            <Field
              label={editing ? 'New password' : 'Password'}
              htmlFor="user-password"
              error={errors.password?.message}
              hint={
                editing
                  ? 'Leave blank to keep the current password. Setting one signs the person out everywhere.'
                  : 'At least 10 characters.'
              }
            >
              <Input
                {...fieldA11y('user-password', errors.password?.message)}
                {...register('password')}
                type="password"
                autoComplete="new-password"
              />
            </Field>
          )}
          {failure ? (
            <p role="alert" className="text-small font-semibold text-foreground">
              {failure}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              Save
            </Button>
            <Button variant="quiet" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
