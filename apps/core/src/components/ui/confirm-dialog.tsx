import { useEffect, useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { useReturnFocus } from '@/hooks/use-return-focus';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  /** Where focus goes on close if the element that opened the dialog is gone (a deleted row). */
  fallbackFocusId?: string;
}

/** Destructive actions ask with explicit wording and a navy button, never red. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  fallbackFocusId,
}: ConfirmDialogProps) {
  const returnFocus = useReturnFocus(fallbackFocusId);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (open) {
      setPending(false);
      setFailed(false);
    }
  }, [open]);

  async function confirm() {
    setPending(true);
    setFailed(false);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        // Not while the action is in flight: a failure would land on a closed dialog and be lost.
        if (!pending) onOpenChange(next);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <AlertDialog.Content
          onOpenAutoFocus={returnFocus.onOpenAutoFocus}
          onCloseAutoFocus={returnFocus.onCloseAutoFocus}
          className="cut-br fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 bg-background p-6 [--cut:1.75rem] sm:p-8">
          <AlertDialog.Title className="text-title font-semibold text-foreground">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-body text-navy-80">{description}</AlertDialog.Description>
          {failed ? (
            <p role="alert" className="mt-4 text-small font-semibold text-foreground">
              That did not work. Try again.
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button onClick={confirm} disabled={pending}>
              {confirmLabel}
            </Button>
            <AlertDialog.Cancel className={buttonVariants({ variant: 'quiet' })} disabled={pending}>
              Cancel
            </AlertDialog.Cancel>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
