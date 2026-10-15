import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { PlannedDialogSpec } from './types';

interface PlannedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spec: PlannedDialogSpec;
  /** Where focus goes on close if the button that opened the dialog is gone. */
  fallbackFocusId?: string;
}

/** What a feature's own dialog takes: the open state. It fills in its spec and its focus fallback. */
export type PlannedDialogToggle = Pick<PlannedDialogProps, 'open' | 'onOpenChange'>;

/** A dialog that is described but not built: its fields and what saving it does, as lists. Not a form. */
export function PlannedDialog({ open, onOpenChange, spec, fallbackFocusId }: PlannedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fallbackFocusId={fallbackFocusId}>
        <DialogTitle>{spec.title}</DialogTitle>
        <DialogDescription>{spec.summary}</DialogDescription>
        <p className="mt-4 text-small font-semibold uppercase tracking-[0.08em] text-navy-80">
          Preview only, not a working form
        </p>
        <h3 className="mb-2 mt-4 text-body font-semibold">Fields</h3>
        <ul className="grid list-disc gap-1 pl-5 text-body">
          {spec.fields.map((field) => (
            <li key={field}>{field}</li>
          ))}
        </ul>
        <h3 className="mb-2 mt-6 text-body font-semibold">What happens</h3>
        <ul className="grid list-disc gap-1 pl-5 text-body">
          {spec.happens.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
