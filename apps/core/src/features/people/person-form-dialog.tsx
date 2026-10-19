import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { ChoiceChip } from '@/components/ui/choice-chip';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Arm } from '@/components/ui/marks';
import { useTechnologies } from '@/features/technologies/api';
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
  const technologies = useTechnologies();
  const save = useSavePerson();
  const [failed, setFailed] = useState(false);
  const {
    register,
    control,
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

  // The person's own technologies are always offered, so a technology list that is still loading, has failed or has
  // since lost one cannot clear them on save.
  const technologyOptions = useMemo(() => {
    const options = (technologies.data ?? []).map((technology) => ({ id: technology.id, label: technology.name }));
    for (const own of person?.technologies ?? []) {
      if (!options.some((option) => option.id === own.id)) options.push({ id: own.id, label: own.name });
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [technologies.data, person]);

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
            label="Monthly salary (INR)"
            htmlFor="person-monthly-salary"
            error={errors.monthlySalary?.message}
            hint="Rupees and paise, like 85000.00."
          >
            <Input
              {...fieldA11y('person-monthly-salary', errors.monthlySalary?.message)}
              {...register('monthlySalary')}
              inputMode="decimal"
              autoComplete="off"
            />
          </Field>
          <Controller
            control={control}
            name="technologyIds"
            render={({ field }) => (
              <fieldset className="grid content-start gap-2">
                <legend className="mb-1 flex min-h-6 items-center gap-2 text-small font-semibold text-foreground">
                  <Arm className="w-3 text-rule" />
                  Technologies
                </legend>
                {technologyOptions.length === 0 && technologies.isSuccess ? (
                  <p className="text-small text-navy-72">No technologies yet. Add some on the Technologies page.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {technologyOptions.map((option) => {
                      const id = String(option.id);
                      return (
                        <ChoiceChip
                          key={id}
                          checked={field.value.includes(id)}
                          onChange={(event) =>
                            field.onChange(
                              event.target.checked ? [...field.value, id] : field.value.filter((value) => value !== id),
                            )
                          }
                        >
                          {option.label}
                        </ChoiceChip>
                      );
                    })}
                  </div>
                )}
                {technologies.isError ? (
                  <p className="text-small text-navy-72">Technologies could not be loaded.</p>
                ) : null}
              </fieldset>
            )}
          />
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
