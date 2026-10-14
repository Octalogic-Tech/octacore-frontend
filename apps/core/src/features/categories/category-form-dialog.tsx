import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateCategory, useUpdateCategory } from './api';
import { categorySchema, type CategoryInput } from './schema';
import type { Category } from './types';

const emptyValues: CategoryInput = { name: '', description: '' };

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing, absent when adding. */
  category?: Category;
}

export function CategoryFormDialog({ open, onOpenChange, category }: CategoryFormDialogProps) {
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const [saveFailed, setSaveFailed] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryInput>({ resolver: zodResolver(categorySchema), defaultValues: emptyValues });

  useEffect(() => {
    if (open) {
      reset(category ? { name: category.name, description: category.description } : emptyValues);
      setSaveFailed(false);
    }
  }, [open, category, reset]);

  const submit = handleSubmit(async (values) => {
    setSaveFailed(false);
    try {
      if (category) await update.mutateAsync({ id: category.id, ...values });
      else await create.mutateAsync(values);
      onOpenChange(false);
    } catch {
      setSaveFailed(true);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{category ? 'Edit category' : 'New category'}</DialogTitle>
        <DialogDescription>Give the category a name and a short description.</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
          <Field label="Name" htmlFor="category-name" error={errors.name?.message}>
            <Input {...fieldA11y('category-name', errors.name?.message)} {...register('name')} autoComplete="off" />
          </Field>
          <Field label="Description" htmlFor="category-description" error={errors.description?.message}>
            <Textarea {...fieldA11y('category-description', errors.description?.message)} {...register('description')} />
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
            <Button variant="quiet" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
