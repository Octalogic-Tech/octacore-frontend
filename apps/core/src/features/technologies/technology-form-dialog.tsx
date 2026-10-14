import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateTechnology, useUpdateTechnology } from './api';
import { technologySchema, type TechnologyInput } from './schema';
import type { Technology } from './types';

const emptyValues: TechnologyInput = { name: '', category: '', description: '' };

interface TechnologyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing, absent when adding. */
  technology?: Technology;
}

export function TechnologyFormDialog({ open, onOpenChange, technology }: TechnologyFormDialogProps) {
  const create = useCreateTechnology();
  const update = useUpdateTechnology();
  const [saveFailed, setSaveFailed] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TechnologyInput>({ resolver: zodResolver(technologySchema), defaultValues: emptyValues });

  useEffect(() => {
    if (open) {
      reset(
        technology
          ? { name: technology.name, category: technology.category ?? '', description: technology.description }
          : emptyValues,
      );
      setSaveFailed(false);
    }
  }, [open, technology, reset]);

  const submit = handleSubmit(async (values) => {
    setSaveFailed(false);
    try {
      if (technology) await update.mutateAsync({ id: technology.id, ...values });
      else await create.mutateAsync(values);
      onOpenChange(false);
    } catch {
      setSaveFailed(true);
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
      <DialogContent fallbackFocusId="technology-search">
        <DialogTitle>{technology ? 'Edit technology' : 'New technology'}</DialogTitle>
        <DialogDescription>Name the technology and say what it is used for.</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
          <Field label="Name" htmlFor="technology-name" error={errors.name?.message}>
            <Input {...fieldA11y('technology-name', errors.name?.message)} {...register('name')} autoComplete="off" />
          </Field>
          <Field
            label="Category"
            htmlFor="technology-category"
            hint="Optional, for example Frontend or Backend."
            error={errors.category?.message}
          >
            <Input
              {...fieldA11y('technology-category', errors.category?.message)}
              {...register('category')}
              autoComplete="off"
            />
          </Field>
          <Field label="Description" htmlFor="technology-description" error={errors.description?.message}>
            <Textarea
              {...fieldA11y('technology-description', errors.description?.message)}
              {...register('description')}
            />
          </Field>
          {saveFailed ? (
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
