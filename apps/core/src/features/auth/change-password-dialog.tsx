import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { serviceMessage } from '@/lib/core-api';
import { useAuth } from './auth-context';
import { changePasswordSchema, type ChangePasswordInput } from './schema';

const emptyValues: ChangePasswordInput = { currentPassword: '', newPassword: '', confirmPassword: '' };

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The id of the button that opens it, where focus goes back to when the dialog closes. */
  openerId?: string;
}

export function ChangePasswordDialog({ open, onOpenChange, openerId }: ChangePasswordDialogProps) {
  const { changePassword } = useAuth();
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema), defaultValues: emptyValues });

  useEffect(() => {
    if (open) {
      reset(emptyValues);
      setFailure(null);
    }
  }, [open, reset]);

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      onOpenChange(false);
    } catch (error) {
      // A wrong current password is a 422 whose message is written for people; anything else is generic.
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
      <DialogContent fallbackFocusId={openerId}>
        <DialogTitle>Change password</DialogTitle>
        <DialogDescription>You stay signed in here. Your other devices are signed out.</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
          <Field label="Current password" htmlFor="change-password-current" error={errors.currentPassword?.message}>
            <Input
              {...fieldA11y('change-password-current', errors.currentPassword?.message)}
              {...register('currentPassword')}
              type="password"
              autoComplete="current-password"
            />
          </Field>
          <Field label="New password" htmlFor="change-password-new" error={errors.newPassword?.message}>
            <Input
              {...fieldA11y('change-password-new', errors.newPassword?.message)}
              {...register('newPassword')}
              type="password"
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password" htmlFor="change-password-confirm" error={errors.confirmPassword?.message}>
            <Input
              {...fieldA11y('change-password-confirm', errors.confirmPassword?.message)}
              {...register('confirmPassword')}
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
