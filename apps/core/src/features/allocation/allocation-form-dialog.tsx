import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { usePeople } from '@/features/people/api';
import { useProjects } from '@/features/projects/api';
import { serviceMessage, statusOf } from '@/lib/core-api';
import { useAddCard, useAllocations, useSaveAllocation } from './api';
import {
  BENCH,
  NEW_CARD,
  REMOVED,
  allocationFormSchema,
  cardChoices,
  toAllocationBody,
  toAllocationFormValues,
  type AllocationFormValues,
  type AllocationRow,
} from './schema';

interface AllocationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing, absent when adding. A snapshot taken when the dialog was opened. */
  entry?: AllocationRow;
  /** The person the entry is for, when the page already says who (a person's own page): the Person field is left out. */
  personId?: number;
  /** Where focus goes on close if the element that opened the dialog is gone (a deleted row). */
  fallbackFocusId: string;
}

interface Option {
  id: number;
  label: string;
}

/** What the service says when the card has an entry on that date already: it belongs on the date. */
const DUPLICATE_DATE = 'This person already has an entry';

/** The entry's own project is always an option, so a list that is loading, has failed or lost it cannot blank the select. */
function withCurrent(options: Option[], current: Option | undefined): Option[] {
  if (current && !options.some((option) => option.id === current.id)) return [...options, current];
  return options;
}

const byLabel = (a: Option, b: Option) => a.label.localeCompare(b.label);

export function AllocationFormDialog({ open, onOpenChange, entry, personId, fallbackFocusId }: AllocationFormDialogProps) {
  const people = usePeople();
  const projects = useProjects();
  const save = useSaveAllocation();
  const addCard = useAddCard();
  // A message to show above the buttons: the service's own words when it wrote them for people, or ours.
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AllocationFormValues>({ resolver: zodResolver(allocationFormSchema), defaultValues: toAllocationFormValues() });

  useEffect(() => {
    if (open) {
      const values = toAllocationFormValues(entry);
      reset(entry === undefined && personId !== undefined ? { ...values, personId: String(personId) } : values);
      setFailure(null);
    }
  }, [open, entry, personId, reset]);

  // The cards the person has, for the Card field: from their entries (all of them when no person is fixed, which the
  // ledger has already read, and the chosen person's out of those).
  const chosenPerson = personId ?? (Number(watch('personId')) || undefined);
  const entries = useAllocations(personId === undefined ? undefined : { personId });
  const cards = useMemo(
    () => cardChoices((entries.data ?? []).filter((row) => row.personId === chosenPerson)),
    [entries.data, chosenPerson],
  );
  const chosenCard = watch('card');
  useEffect(() => {
    // Another person's cards are other numbers: a card they do not have is not kept.
    if (!entry && chosenCard !== NEW_CARD && !cards.includes(Number(chosenCard))) setValue('card', '1');
  }, [entry, chosenCard, cards, setValue]);

  const personOptions = useMemo(
    () => (people.data ?? []).map((person) => ({ id: person.id, label: person.name })).sort(byLabel),
    [people.data],
  );
  const projectOptions = useMemo(
    () =>
      withCurrent(
        (projects.data ?? []).map((project) => ({ id: project.id, label: project.name })),
        entry?.project ? { id: entry.project.id, label: entry.project.name } : undefined,
      ).sort(byLabel),
    [projects.data, entry],
  );

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      const body = toAllocationBody(values);
      if (entry) {
        await save.mutateAsync({
          id: entry.id,
          body: { ...body, card: entry.card },
          current: { projectId: entry.projectId, removed: entry.removed },
        });
      } else if (body.card === null) {
        // A new card is numbered by the service, which has the person's cards: it has its own endpoint.
        await addCard.mutateAsync({
          personId: body.personId,
          projectId: body.projectId,
          effectiveDate: body.effectiveDate,
          note: body.note,
        });
      } else {
        await save.mutateAsync({ body: { ...body, card: body.card } });
      }
    } catch (error) {
      const status = statusOf(error);
      const message = serviceMessage(error);
      if (status === 409 && message?.startsWith(DUPLICATE_DATE)) {
        // A card has one entry a day: say so on the date, which is the one thing to change.
        setError('effectiveDate', { type: 'server', message });
        setFocus('effectiveDate');
      } else if (entry !== undefined && status === 404) {
        // Saving again would repeat an edit that cannot succeed once the entry is gone.
        setFailure('This entry was removed elsewhere, so it cannot be saved. Close this dialog and go back to the ledger.');
      } else {
        setFailure(message ?? 'That did not save. Try again.');
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
        <DialogTitle>{entry ? 'Edit allocation entry' : 'New allocation entry'}</DialogTitle>
        <DialogDescription>From the date you choose, the person is on this project or on the bench.</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
          {personId !== undefined ? null : entry ? (
            <Field
              label="Person"
              htmlFor="allocation-person"
              hint="The person of an entry cannot be changed."
            >
              <Input id="allocation-person" value={entry.person.name} readOnly />
            </Field>
          ) : (
            <Field
              label="Person"
              htmlFor="allocation-person"
              error={errors.personId?.message}
              hint={people.isError ? 'People could not be loaded.' : undefined}
            >
              <Select {...fieldA11y('allocation-person', errors.personId?.message)} {...register('personId')}>
                <option value="">Choose…</option>
                {personOptions.map((option) => (
                  <option key={option.id} value={String(option.id)}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {entry ? (
            <Field label="Card" htmlFor="allocation-card" hint="The card of an entry cannot be changed.">
              <Input id="allocation-card" value={`Card ${entry.card}`} readOnly />
            </Field>
          ) : (
            <Field label="Card" htmlFor="allocation-card" error={errors.card?.message}>
              <Select {...fieldA11y('allocation-card', errors.card?.message)} {...register('card')}>
                {cards.map((card) => (
                  <option key={card} value={String(card)}>
                    Card {card}
                  </option>
                ))}
                <option value={NEW_CARD}>New card</option>
              </Select>
            </Field>
          )}
          <Field
            label="Project"
            htmlFor="allocation-project"
            error={errors.projectId?.message}
            hint={projects.isError ? 'Projects could not be loaded.' : undefined}
          >
            <Select {...fieldA11y('allocation-project', errors.projectId?.message)} {...register('projectId')}>
              <option value={BENCH}>Bench</option>
              {projectOptions.map((option) => (
                <option key={option.id} value={String(option.id)}>
                  {option.label}
                </option>
              ))}
              <option value={REMOVED}>Card removed</option>
            </Select>
          </Field>
          <Field
            label="Effective date"
            htmlFor="allocation-date"
            error={errors.effectiveDate?.message}
            hint="The person is here from this day on. A past date fills in history."
          >
            <Input
              {...fieldA11y('allocation-date', errors.effectiveDate?.message)}
              {...register('effectiveDate')}
              type="date"
            />
          </Field>
          <Field label="Note" htmlFor="allocation-note" error={errors.note?.message}>
            <Input {...fieldA11y('allocation-note', errors.note?.message)} {...register('note')} autoComplete="off" />
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
