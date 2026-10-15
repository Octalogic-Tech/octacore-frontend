import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { fetchInvoicePdf } from './api';
import { downloadInvoicePdf, notSetUpMessage } from './invoice-pdf';

interface InvoiceRef {
  id: number;
  number: string;
}

interface InvoicePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceRef | null;
  /** Where focus goes on close if the element that opened the dialog is gone. */
  fallbackFocusId?: string;
}

export function InvoicePreviewDialog({ open, onOpenChange, invoice, fallbackFocusId }: InvoicePreviewDialogProps) {
  return (
    <Dialog open={open && invoice !== null} onOpenChange={onOpenChange}>
      <DialogContent fallbackFocusId={fallbackFocusId} className="max-w-5xl">
        <DialogTitle>{invoice ? `Preview ${invoice.number}` : 'Preview'}</DialogTitle>
        <DialogDescription>The invoice as the client receives it, drawn from what is saved.</DialogDescription>
        {/* Mounted only while open: every opening asks for the file again, so it always shows what is saved now. */}
        {invoice ? <PreviewBody invoice={invoice} /> : null}
      </DialogContent>
    </Dialog>
  );
}

type Preview = { status: 'loading' } | { status: 'ready'; url: string } | { status: 'error'; message: string };

function PreviewBody({ invoice }: { invoice: InvoiceRef }) {
  const [preview, setPreview] = useState<Preview>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [downloadFailure, setDownloadFailure] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url: string | undefined;
    setPreview({ status: 'loading' });
    fetchInvoicePdf(invoice.id).then(
      (blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreview({ status: 'ready', url });
      },
      (error: unknown) => {
        if (!cancelled) setPreview({ status: 'error', message: notSetUpMessage(error) ?? 'The invoice could not be shown.' });
      },
    );
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [invoice.id, attempt]);

  async function download() {
    setDownloadFailure(null);
    try {
      await downloadInvoicePdf(invoice);
    } catch (error) {
      setDownloadFailure(notSetUpMessage(error) ?? 'That did not download. Try again.');
    }
  }

  return (
    <div className="mt-4 grid gap-4">
      {preview.status === 'loading' ? (
        <p role="status" className="text-body">
          Drawing the invoice…
        </p>
      ) : null}
      {preview.status === 'error' ? (
        <div role="alert" className="grid justify-items-start gap-2">
          <p className="text-body">{preview.message}</p>
          <Button variant="quiet" onClick={() => setAttempt((count) => count + 1)}>
            Try again
          </Button>
        </div>
      ) : null}
      {preview.status === 'ready' ? (
        <iframe title={`Invoice ${invoice.number}`} src={preview.url} className="h-[70vh] w-full border border-navy" />
      ) : null}
      {downloadFailure ? (
        <p role="alert" className="text-small font-semibold text-foreground">
          {downloadFailure}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={preview.status !== 'ready'} onClick={() => void download()}>
          Download
        </Button>
      </div>
    </div>
  );
}
