import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlannedFeature } from '@/features/planned/planned-feature';
import { ScheduleDialog } from './schedule-dialog';
import { recurringInvoicesSpec, scheduleDialog } from './spec';

/** Skeleton: describes the page and previews its dialog. Replace it with the real page when this is picked up. */
export function RecurringInvoicesPage() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PlannedFeature
        spec={recurringInvoicesSpec}
        actions={
          <Button variant="quiet" id="preview-schedule" onClick={() => setOpen(true)}>
            {scheduleDialog.previewLabel}
          </Button>
        }
      />
      <ScheduleDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
