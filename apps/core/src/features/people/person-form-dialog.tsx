import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useSavePerson } from './api';
import {
  emptyPersonForm,
  personFormSchema,
  toFormValues,
  toPersonBody,
  type PersonFormValues,
  type PersonRow,
} from './schema';

interface PersonFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing, absent when adding. A snapshot taken when the dialog was opened. */
  person?: PersonRow;
}

export function PersonFormDialog({ open, onOpenChange, person }: PersonFormDialogProps) {
  const save = useSavePerson();
  const [failed, setFailed] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PersonFormValues>({ resolver: zodResolver(personFormSchema), defaultValues: emptyPersonForm });

  useEffect(() => {
    if (open) {
      reset(toFormValues(person));
      setFailed(false);
    }
  }, [open, person, reset]);

  const submit = handleSubmit(async (values) => {
    setFailed(false);
    try {
      await save.mutateAsync({ id: person?.id, body: toPersonBody(values) });
    } catch {
      setFailed(true);
      return;
    }
    onOpenChange(false);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Not while saving: a failure would land on a closed dialog and be lost.
        if (!isSubmitting) onOpenChange(next);
      }}
    >
      <DialogContent fallbackFocusId="person-search">
        <DialogTitle>{person ? 'Edit person' : 'New person'}</DialogTitle>
        <DialogDescription>Only the name is required.</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
          <Field label="Name" htmlFor="person-name" error={errors.name?.message}>
            <Input {...fieldA11y('person-name', errors.name?.message)} {...register('name')} autoComplete="off" />
          </Field>
          <Field label="Email" htmlFor="person-email" error={errors.email?.message}>
            <Input
              {...fieldA11y('person-email', errors.email?.message)}
              {...register('email')}
              type="email"
              autoComplete="off"
            />
          </Field>
          <Field label="Phone" htmlFor="person-phone" error={errors.phone?.message}>
            <Input
              {...fieldA11y('person-phone', errors.phone?.message)}
              {...register('phone')}
              type="tel"
              autoComplete="off"
            />
          </Field>
          <Field label="Joined" htmlFor="person-join-date" error={errors.joinDate?.message}>
            <Input {...fieldA11y('person-join-date', errors.joinDate?.message)} {...register('joinDate')} type="date" />
          </Field>
          <Field label="Left" htmlFor="person-leave-date" error={errors.leaveDate?.message}>
            <Input
              {...fieldA11y('person-leave-date', errors.leaveDate?.message)}
              {...register('leaveDate')}
              type="date"
            />
          </Field>
          <Field label="Image link" htmlFor="person-image-link" error={errors.imageLink?.message}>
            <Input
              {...fieldA11y('person-image-link', errors.imageLink?.message)}
              {...register('imageLink')}
              type="url"
              autoComplete="off"
            />
          </Field>
          <Field label="Contract link" htmlFor="person-contract-link" error={errors.contractLink?.message}>
            <Input
              {...fieldA11y('person-contract-link', errors.contractLink?.message)}
              {...register('contractLink')}
              type="url"
              autoComplete="off"
            />
          </Field>
          <Field
            label="Monthly salary (USD)"
            htmlFor="person-monthly-salary"
            error={errors.monthlySalary?.message}
            hint="Dollars and cents, like 5600.00."
          >
            <Input
              {...fieldA11y('person-monthly-salary', errors.monthlySalary?.message)}
              {...register('monthlySalary')}
              inputMode="decimal"
              autoComplete="off"
            />
          </Field>
          {failed ? (
            <p role="alert" className="text-small font-semibold text-foreground">
              That did not save. Try again.
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
