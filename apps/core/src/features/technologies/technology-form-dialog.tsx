import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCategories } from '@/features/categories/api';
import { useCreateTechnology, useUpdateTechnology } from './api';
import { technologySchema, type TechnologyChanges, type TechnologyInput } from './schema';
import type { Technology } from './types';

const emptyValues: TechnologyInput = { name: '', description: '', categoryId: null };

interface TechnologyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing, absent when adding. */
  technology?: Technology;
}

export function TechnologyFormDialog({ open, onOpenChange, technology }: TechnologyFormDialogProps) {
  const create = useCreateTechnology();
  const update = useUpdateTechnology();
  const categories = useCategories();
  const [saveFailed, setSaveFailed] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TechnologyInput>({ resolver: zodResolver(technologySchema), defaultValues: emptyValues });

  // The service only embeds a category that still exists, so a row with no category name has none or lost it:
  // the select shows None, and saving clears the stale link. The row decides, not the cached category list, which
  // may predate the category: trusting the list would erase a valid link on the next save. Nothing here depends on
  // the list, so it arriving (or changing) never resets what the person is typing.
  const initialValues = useMemo<TechnologyInput>(() => {
    if (!technology) return emptyValues;
    return {
      name: technology.name,
      description: technology.description,
      categoryId: technology.categoryName ? technology.categoryId : null,
    };
  }, [technology]);

  // The cached list plus, when it has not heard of the technology's own category yet, that category.
  const options = useMemo(() => {
    const listed = categories.data ?? [];
    if (!technology?.categoryName || technology.categoryId === null) return listed;
    const known = listed.some((category) => category.id === technology.categoryId);
    return known ? listed : [...listed, { id: technology.categoryId, name: technology.categoryName }];
  }, [categories.data, technology]);

  useEffect(() => {
    if (open) {
      reset(initialValues);
      setSaveFailed(false);
    }
  }, [open, initialValues, reset]);

  const submit = handleSubmit(async (values) => {
    setSaveFailed(false);
    // Without the category list the select cannot show the current link, so leave it out: a PATCH then keeps it.
    const changes: TechnologyChanges = categories.isSuccess
      ? values
      : { name: values.name, description: values.description };
    try {
      if (technology) await update.mutateAsync({ id: technology.id, ...changes });
      else await create.mutateAsync(changes);
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
            hint={categories.isError ? 'Categories could not be loaded.' : 'Optional.'}
            error={errors.categoryId?.message}
          >
            {categories.isSuccess ? (
              <Select
                {...fieldA11y('technology-category', errors.categoryId?.message)}
                // react-hook-form feeds the form value (null for no category) through this as well as the DOM string
                {...register('categoryId', { setValueAs: (value) => (value ? Number(value) : null) })}
              >
                <option value="">None</option>
                {options.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Select id="technology-category" disabled defaultValue="">
                <option value="">None</option>
              </Select>
            )}
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
