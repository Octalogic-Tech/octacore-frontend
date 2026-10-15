import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useClients } from '@/features/clients/api';
import { useSaveProject } from './api';
import {
  billingOptions,
  emptyProjectForm,
  projectFormSchema,
  projectTypeOptions,
  toProjectBody,
  toProjectFormValues,
  type ProjectFormValues,
  type ProjectRow,
} from './schema';

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing, absent when adding. A snapshot taken when the dialog was opened. */
  project?: ProjectRow;
  /** Where focus goes on close if the element that opened the dialog is gone. */
  fallbackFocusId?: string;
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  fallbackFocusId = 'project-search',
}: ProjectFormDialogProps) {
  const clients = useClients();
  const save = useSaveProject();
  const [failed, setFailed] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({ resolver: zodResolver(projectFormSchema), defaultValues: emptyProjectForm });

  useEffect(() => {
    if (open) {
      reset(toProjectFormValues(project));
      setFailed(false);
    }
  }, [open, project, reset]);

  // The project's own client is always an option, so a client list that is still loading or has failed cannot
  // blank the select and erase the client on save.
  const clientOptions = useMemo(() => {
    const options = (clients.data ?? []).map((client) => ({ id: client.id, label: client.name }));
    const current =
      project && project.clientId !== null && project.clientName !== ''
        ? { id: project.clientId, label: project.clientName }
        : undefined;
    if (current && !options.some((option) => option.id === current.id)) options.push(current);
    return options;
  }, [clients.data, project]);

  const submit = handleSubmit(async (values) => {
    setFailed(false);
    try {
      await save.mutateAsync({ id: project?.id, body: toProjectBody(values) });
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
      <DialogContent fallbackFocusId={fallbackFocusId}>
        <DialogTitle>{project ? 'Edit project' : 'New project'}</DialogTitle>
        <DialogDescription>Say who the project is for, what kind of work it is and how it is billed.</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
          <Field label="Name" htmlFor="project-name" error={errors.name?.message}>
            <Input {...fieldA11y('project-name', errors.name?.message)} {...register('name')} autoComplete="off" />
          </Field>
          <Field label="Description" htmlFor="project-description" error={errors.description?.message}>
            <Textarea
              {...fieldA11y('project-description', errors.description?.message)}
              {...register('description')}
            />
          </Field>
          <Field
            label="Client"
            htmlFor="project-client"
            error={errors.clientId?.message}
            hint={clients.isError ? 'Clients could not be loaded.' : undefined}
          >
            <Select {...fieldA11y('project-client', errors.clientId?.message)} {...register('clientId')}>
              <option value="">None</option>
              {clientOptions.map((option) => (
                <option key={option.id} value={String(option.id)}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Project type" htmlFor="project-type" error={errors.projectType?.message}>
            <Select {...fieldA11y('project-type', errors.projectType?.message)} {...register('projectType')}>
              <option value="">Choose…</option>
              {projectTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Billing type" htmlFor="project-billing" error={errors.billingType?.message}>
            <Select {...fieldA11y('project-billing', errors.billingType?.message)} {...register('billingType')}>
              <option value="">Choose…</option>
              {billingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
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
