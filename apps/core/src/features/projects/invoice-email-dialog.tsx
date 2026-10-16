import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { statusOf } from '@/lib/core-api';
import { useEmailDraft, useSendInvoice } from './api';
import { notSetUpMessage } from './invoice-pdf';
import { emailFormSchema, toEmailFormValues, toSendBody, type EmailDraft, type EmailFormValues } from './schema';

interface InvoiceRef {
  id: number;
  number: string;
}

interface InvoiceEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceRef | null;
  /** Called with a sentence for the page to show once the email has gone out. */
  onSent: (message: string) => void;
  /** Where focus goes on close if the element that opened the dialog is gone. */
  fallbackFocusId?: string;
}

export function InvoiceEmailDialog({ open, onOpenChange, invoice, onSent, fallbackFocusId }: InvoiceEmailDialogProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open && invoice !== null}
      onOpenChange={(next) => {
        // Not while sending: the answer would land on a closed dialog and be lost.
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent fallbackFocusId={fallbackFocusId} className="max-w-2xl">
        <DialogTitle>{invoice ? `Email ${invoice.number}` : 'Email'}</DialogTitle>
        <DialogDescription>Sends the invoice as a PDF attachment. Change anything before you send.</DialogDescription>
        {/* Mounted only while open, so every opening starts from a fresh draft. */}
        {invoice ? (
          <EmailBody invoice={invoice} onBusyChange={setBusy} onClose={() => onOpenChange(false)} onSent={onSent} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface EmailBodyProps {
  invoice: InvoiceRef;
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
  onSent: (message: string) => void;
}

function EmailBody({ invoice, onBusyChange, onClose, onSent }: EmailBodyProps) {
  const draft = useEmailDraft(invoice.id);

  if (draft.isLoading) {
    return (
      <p role="status" className="mt-6 text-body">
        Preparing the email…
      </p>
    );
  }
  if (draft.isError || !draft.data) {
    return (
      <div role="alert" className="mt-6 grid justify-items-start gap-2">
        <p className="text-body">{notSetUpMessage(draft.error) ?? 'The email could not be prepared.'}</p>
        <Button variant="quiet" onClick={() => void draft.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  return <EmailForm invoice={invoice} draft={draft.data} onBusyChange={onBusyChange} onClose={onClose} onSent={onSent} />;
}

function EmailForm({ invoice, draft, onBusyChange, onClose, onSent }: EmailBodyProps & { draft: EmailDraft }) {
  const send = useSendInvoice();
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailFormValues>({ resolver: zodResolver(emailFormSchema), defaultValues: toEmailFormValues(draft) });

  useEffect(() => {
    onBusyChange(isSubmitting);
  }, [isSubmitting, onBusyChange]);
  useEffect(() => () => onBusyChange(false), [onBusyChange]);

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    const body = toSendBody(values);
    try {
      await send.mutateAsync({ id: invoice.id, body });
    } catch (error) {
      const status = statusOf(error);
      setFailure(
        notSetUpMessage(error) ??
          (status === 502
            ? 'The email could not be sent. Check the address and try again.'
            : status === 404
              ? 'This invoice was removed elsewhere, so it cannot be sent. Close this dialog and go back to Projects.'
              : 'That did not send. Try again.'),
      );
      return;
    }
    onSent(`Invoice ${invoice.number} sent to ${body.to.join(', ')}.`);
    onClose();
  });

  return (
    <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
      <Field
        label="To"
        htmlFor="email-to"
        error={errors.to?.message}
        hint="Separate addresses with a comma or a semicolon."
      >
        <Input {...fieldA11y('email-to', errors.to?.message)} {...register('to')} autoComplete="off" />
      </Field>
      <Field label="Subject" htmlFor="email-subject" error={errors.subject?.message}>
        <Input {...fieldA11y('email-subject', errors.subject?.message)} {...register('subject')} autoComplete="off" />
      </Field>
      <Field label="Message" htmlFor="email-message" error={errors.message?.message}>
        <Textarea {...fieldA11y('email-message', errors.message?.message)} {...register('message')} rows={10} />
      </Field>
      {failure ? (
        <p role="alert" className="text-small font-semibold text-foreground">
          {failure}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          Send
        </Button>
        <Button variant="quiet" disabled={isSubmitting} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
