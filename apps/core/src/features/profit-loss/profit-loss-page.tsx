import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlannedFeature } from '@/features/planned/planned-feature';
import { ExpenseDialog } from './expense-dialog';
import { profitLossSpec, expenseDialog } from './spec';

/** Skeleton: describes the page and previews its dialog. Replace it with the real page when this is picked up. */
export function ProfitLossPage() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PlannedFeature
        spec={profitLossSpec}
        actions={
          <Button variant="quiet" id="preview-expense" onClick={() => setOpen(true)}>
            {expenseDialog.previewLabel}
          </Button>
        }
      />
      <ExpenseDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
