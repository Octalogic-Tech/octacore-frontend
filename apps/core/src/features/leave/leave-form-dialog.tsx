import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { usePeople } from '@/features/people/api';
import { serviceMessage, statusOf } from '@/lib/core-api';
import { useSaveLeave } from './api';
import {
  LEAVE_TYPES,
  leaveFormSchema,
  toLeaveBody,
  toLeaveFormValues,
  type LeaveFormValues,
  type LeaveRow,
} from './schema';

interface LeaveFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing, absent when adding. A snapshot taken when the dialog was opened. */
  leave?: LeaveRow;
  /** The person the leave is for, when the page already says who (a person's own page): the Person field is left out. */
  personId?: number;
  /** Where focus goes on close if the element that opened the dialog is gone (a deleted row). */
  fallbackFocusId: string;
}

export function LeaveFormDialog({ open, onOpenChange, leave, personId, fallbackFocusId }: LeaveFormDialogProps) {
  const people = usePeople();
  const save = useSaveLeave();
  // A message to show above the buttons: the service's own words when it wrote them for people (a leave that overlaps
  // another of the person's names the days it clashes with), or ours.
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeaveFormValues>({ resolver: zodResolver(leaveFormSchema), defaultValues: toLeaveFormValues() });

  useEffect(() => {
    if (open) {
      const values = toLeaveFormValues(leave);
      reset(leave === undefined && personId !== undefined ? { ...values, personId: String(personId) } : values);
      setFailure(null);
    }
  }, [open, leave, personId, reset]);

  const personOptions = useMemo(
    () =>
      (people.data ?? [])
        .map((person) => ({ id: person.id, label: person.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [people.data]
  );

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await save.mutateAsync({ id: leave?.id, body: toLeaveBody(values) });
    } catch (error) {
      if (leave !== undefined && statusOf(error) === 404) {
        // Saving again would repeat an edit that cannot succeed once the leave is gone.
        setFailure(
          'This leave was removed elsewhere, so it cannot be saved. Close this dialog and go back to the register.'
        );
      } else {
        setFailure(serviceMessage(error) ?? 'That did not save. Try again.');
      }
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
      <DialogContent fallbackFocusId={fallbackFocusId}>
        <DialogTitle>{leave ? 'Edit leave' : 'New leave'}</DialogTitle>
        <DialogDescription>
          Both the first and the last day count. A single day has the same date in both.
        </DialogDescription>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
          {personId !== undefined ? null : leave ? (
            <Field label="Person" htmlFor="leave-person" hint="The person of a leave cannot be changed.">
              <Input id="leave-person" value={leave.person.name} readOnly />
            </Field>
          ) : (
            <Field
              label="Person"
              htmlFor="leave-person"
              error={errors.personId?.message}
              hint={people.isError ? 'People could not be loaded.' : undefined}
            >
              <Select {...fieldA11y('leave-person', errors.personId?.message)} {...register('personId')}>
                <option value="">Choose…</option>
                {personOptions.map((option) => (
                  <option key={option.id} value={String(option.id)}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Type" htmlFor="leave-type" error={errors.leaveType?.message}>
            <Select {...fieldA11y('leave-type', errors.leaveType?.message)} {...register('leaveType')}>
              <option value="">Choose…</option>
              {LEAVE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="First day" htmlFor="leave-start" error={errors.startDate?.message}>
              <Input {...fieldA11y('leave-start', errors.startDate?.message)} {...register('startDate')} type="date" />
            </Field>
            <Field label="Last day" htmlFor="leave-end" error={errors.endDate?.message}>
              <Input {...fieldA11y('leave-end', errors.endDate?.message)} {...register('endDate')} type="date" />
            </Field>
          </div>
          <Field label="Reason" htmlFor="leave-reason" error={errors.reason?.message}>
            <Input {...fieldA11y('leave-reason', errors.reason?.message)} {...register('reason')} autoComplete="off" />
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
