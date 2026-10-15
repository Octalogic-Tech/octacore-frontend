import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useCategories } from '@/features/categories/api';
import { usePeople } from '@/features/people/api';
import { statusOf } from '@/lib/core-api';
import { useSaveResource } from './api';
import {
  emptyResourceForm,
  resourceFormSchema,
  toResourceBody,
  toResourceFormValues,
  type ResourceFormValues,
  type ResourceRow,
} from './schema';

interface ResourceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  /** Present when editing, absent when adding. A snapshot taken when the dialog was opened. */
  resource?: ResourceRow;
  /** Where focus goes on close if the element that opened the dialog is gone (the empty state it came from). */
  fallbackFocusId?: string;
}

type Failure = 'failed' | 'changed-elsewhere' | null;

interface Option {
  id: number;
  label: string;
}

/** The record the resource already points at is always an option, so a list that is loading or failed cannot blank it. */
function withCurrent(options: Option[], current: Option | undefined): Option[] {
  if (current && !options.some((option) => option.id === current.id)) return [...options, current];
  return options;
}

export function ResourceFormDialog({
  open,
  onOpenChange,
  projectId,
  resource,
  fallbackFocusId = 'add-resource',
}: ResourceFormDialogProps) {
  const people = usePeople();
  const categories = useCategories();
  const save = useSaveResource(projectId);
  const [failure, setFailure] = useState<Failure>(null);
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ResourceFormValues>({ resolver: zodResolver(resourceFormSchema), defaultValues: emptyResourceForm });

  useEffect(() => {
    if (open) {
      reset(toResourceFormValues(resource));
      setFailure(null);
    }
  }, [open, resource, reset]);

  const personOptions = useMemo(
    () =>
      withCurrent(
        (people.data ?? []).map((person) => ({ id: person.id, label: person.name })),
        resource && resource.personId !== null && resource.personName !== ''
          ? { id: resource.personId, label: resource.personName }
          : undefined,
      ),
    [people.data, resource],
  );
  const categoryOptions = useMemo(
    () =>
      withCurrent(
        (categories.data ?? []).map((category) => ({ id: category.id, label: category.name })),
        resource && resource.categoryName !== ''
          ? { id: resource.categoryId, label: resource.categoryName }
          : undefined,
      ),
    [categories.data, resource],
  );

  const personField = register('personId');

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await save.mutateAsync({ id: resource?.id, body: toResourceBody(values) });
    } catch (error) {
      // Saving again would repeat a call that cannot succeed: a 409 on add (the project, person or category is gone)
      // or a 404 on edit (the resource is). Anything else may be a passing fault, so it says to try again.
      const status = statusOf(error);
      const gone = resource === undefined ? status === 409 : status === 404;
      setFailure(gone ? 'changed-elsewhere' : 'failed');
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
        <DialogTitle>{resource ? 'Edit resource' : 'New resource'}</DialogTitle>
        <DialogDescription>Someone working on this project, with the rate they are billed at.</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
          <Field label="Name" htmlFor="resource-name" error={errors.name?.message}>
            <Input {...fieldA11y('resource-name', errors.name?.message)} {...register('name')} autoComplete="off" />
          </Field>
          <Field
            label="Person"
            htmlFor="resource-person"
            error={errors.personId?.message}
            hint={people.isError ? 'People could not be loaded.' : undefined}
          >
            <Select
              {...fieldA11y('resource-person', errors.personId?.message)}
              {...personField}
              onChange={(event) => {
                void personField.onChange(event);
                const picked = personOptions.find((option) => String(option.id) === event.target.value);
                // Only an empty name is filled: a name the person already typed is theirs.
                if (picked && getValues('name').trim() === '') setValue('name', picked.label);
              }}
            >
              <option value="">None</option>
              {personOptions.map((option) => (
                <option key={option.id} value={String(option.id)}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Category"
            htmlFor="resource-category"
            error={errors.categoryId?.message}
            hint={categories.isError ? 'Categories could not be loaded.' : undefined}
          >
            <Select {...fieldA11y('resource-category', errors.categoryId?.message)} {...register('categoryId')}>
              <option value="">Choose…</option>
              {categoryOptions.map((option) => (
                <option key={option.id} value={String(option.id)}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Rate per hour" htmlFor="resource-rate" error={errors.rate?.message} hint="Whole dollars.">
            <Input
              {...fieldA11y('resource-rate', errors.rate?.message)}
              {...register('rate')}
              inputMode="numeric"
              autoComplete="off"
            />
          </Field>
          {failure === 'failed' ? (
            <p role="alert" className="text-small font-semibold text-foreground">
              That did not save. Try again.
            </p>
          ) : null}
          {failure === 'changed-elsewhere' ? (
            <p role="alert" className="text-small font-semibold text-foreground">
              This changed elsewhere, so it cannot be saved. Close this dialog and go back to Projects.
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
