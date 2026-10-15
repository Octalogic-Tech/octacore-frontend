import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlannedFeature } from '@/features/planned/planned-feature';
import { MilestoneDialog } from './milestone-dialog';
import { milestonesSpec, milestoneDialog } from './spec';

/** Skeleton: describes the page and previews its dialog. Replace it with the real page when this is picked up. */
export function MilestonesPage() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PlannedFeature
        spec={milestonesSpec}
        actions={
          <Button variant="quiet" id="preview-milestone" onClick={() => setOpen(true)}>
            {milestoneDialog.previewLabel}
          </Button>
        }
      />
      <MilestoneDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
