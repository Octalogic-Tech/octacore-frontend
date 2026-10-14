import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCountries } from '@/features/countries/api';
import { contactChangedElsewhere, useSaveClient, useSaveContact } from './api';
import {
  clientFormSchema,
  emptyClientForm,
  planContactStep,
  toClientBody,
  toFormValues,
  type ClientFormValues,
  type ClientRow,
  type ContactRow,
} from './schema';

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing, absent when adding. A snapshot taken when the dialog was opened. */
  client?: ClientRow;
  /** The client's contact, if it has one. */
  contact?: ContactRow;
}

type Failure = 'client' | 'contact' | 'stale-contact' | null;

export function ClientFormDialog({ open, onOpenChange, client, contact }: ClientFormDialogProps) {
  const countries = useCountries();
  const saveClient = useSaveClient();
  const saveContact = useSaveContact();
  // Set once the client exists, so a retry saves it again with PATCH instead of adding a second client.
  const [savedId, setSavedId] = useState<number | undefined>(undefined);
  const [failure, setFailure] = useState<Failure>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({ resolver: zodResolver(clientFormSchema), defaultValues: emptyClientForm });

  useEffect(() => {
    if (open) {
      reset(toFormValues(client, contact));
      setSavedId(undefined);
      setFailure(null);
    }
  }, [open, client, contact, reset]);

  // The client's own country is always an option, so a countries request that is still loading or has failed
  // cannot blank the select and erase the country on save.
  const countryOptions = useMemo(() => {
    const options = (countries.data ?? []).map((country) => ({ id: country.id, label: country.nicename }));
    const current =
      client && client.countryId !== null && client.countryName !== ''
        ? { id: client.countryId, label: client.countryName }
        : undefined;
    if (current && !options.some((option) => option.id === current.id)) options.push(current);
    return options;
  }, [countries.data, client]);

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    let clientId: number;
    try {
      clientId = await saveClient.mutateAsync({ id: savedId ?? client?.id, body: toClientBody(values) });
    } catch {
      setFailure('client');
      return;
    }
    setSavedId(clientId);
    const step = planContactStep(values, clientId, contact);
    if (step) {
      try {
        await saveContact.mutateAsync(step);
      } catch (error) {
        setFailure(contactChangedElsewhere(error) ? 'stale-contact' : 'contact');
        return;
      }
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
      <DialogContent fallbackFocusId="client-search">
        <DialogTitle>{client ? 'Edit client' : 'New client'}</DialogTitle>
        <DialogDescription>Name the client and say where it is. A primary contact is optional.</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
          <Field label="Name" htmlFor="client-name" error={errors.name?.message}>
            <Input {...fieldA11y('client-name', errors.name?.message)} {...register('name')} autoComplete="off" />
          </Field>
          <Field label="Description" htmlFor="client-description" error={errors.description?.message}>
            <Textarea {...fieldA11y('client-description', errors.description?.message)} {...register('description')} />
          </Field>
          <Field
            label="Country"
            htmlFor="client-country"
            error={errors.countryId?.message}
            hint={countries.isError ? 'Countries could not be loaded.' : undefined}
          >
            <Select {...fieldA11y('client-country', errors.countryId?.message)} {...register('countryId')}>
              <option value="">None</option>
              {countryOptions.map((option) => (
                <option key={option.id} value={String(option.id)}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="City" htmlFor="client-city" error={errors.city?.message}>
            <Input {...fieldA11y('client-city', errors.city?.message)} {...register('city')} autoComplete="off" />
          </Field>
          <fieldset className="grid gap-6">
            <legend className="mb-2 text-body font-semibold text-foreground">Primary contact</legend>
            <Field label="Contact name" htmlFor="client-contact-name" error={errors.contactName?.message}>
              <Input
                {...fieldA11y('client-contact-name', errors.contactName?.message)}
                {...register('contactName')}
                autoComplete="off"
              />
            </Field>
            <Field label="Email" htmlFor="client-contact-email" error={errors.contactEmail?.message}>
              <Input
                {...fieldA11y('client-contact-email', errors.contactEmail?.message)}
                {...register('contactEmail')}
                type="email"
                autoComplete="off"
              />
            </Field>
            <Field label="Phone" htmlFor="client-contact-phone" error={errors.contactPhone?.message}>
              <Input
                {...fieldA11y('client-contact-phone', errors.contactPhone?.message)}
                {...register('contactPhone')}
                type="tel"
                autoComplete="off"
              />
            </Field>
          </fieldset>
          {failure === 'client' ? (
            <p role="alert" className="text-small font-semibold text-foreground">
              That did not save. Try again.
            </p>
          ) : null}
          {failure === 'contact' ? (
            <p role="alert" className="text-small font-semibold text-foreground">
              The client was saved, but its contact was not. Try again.
            </p>
          ) : null}
          {failure === 'stale-contact' ? (
            <p role="alert" className="text-small font-semibold text-foreground">
              The client was saved, but its contact was not: the contact changed elsewhere. Close this dialog and
              open the client again.
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
