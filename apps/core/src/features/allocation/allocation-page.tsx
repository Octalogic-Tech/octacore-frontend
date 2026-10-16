import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlannedFeature } from '@/features/planned/planned-feature';
import { AllocateDialog } from './allocate-dialog';
import { allocationSpec, allocateDialog } from './spec';

/** Skeleton: describes the page and previews its dialog. Replace it with the real page when this is picked up. */
export function AllocationPage() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PlannedFeature
        spec={allocationSpec}
        actions={
          <Button variant="quiet" id="preview-allocate" onClick={() => setOpen(true)}>
            {allocateDialog.previewLabel}
          </Button>
        }
      />
      <AllocateDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
