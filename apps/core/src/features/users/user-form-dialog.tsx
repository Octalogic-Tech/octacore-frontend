import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { serviceMessage } from '@/lib/core-api';
import { useCreateUser, useUpdateUser } from './api';
import { emptyUserForm, ROLES, userFormSchema, type UserFormValues } from './schema';
import type { User } from './types';

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing, absent when adding. */
  user?: User;
}

export function UserFormDialog({ open, onOpenChange, user }: UserFormDialogProps) {
  const create = useCreateUser();
  const update = useUpdateUser();
  const [failure, setFailure] = useState<string | null>(null);
  const editing = user !== undefined;
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
    } catch (error) {
      // A 409 (email already in use) carries a message written for people; anything else is generic.
      setFailure(serviceMessage(error) ?? 'That did not save. Try again.');
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
          {editing
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
