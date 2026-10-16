import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlannedFeature } from '@/features/planned/planned-feature';
import { QuoteDialog } from './quote-dialog';
import { quotesSpec, quoteDialog } from './spec';

/** Skeleton: describes the page and previews its dialog. Replace it with the real page when this is picked up. */
export function QuotesPage() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PlannedFeature
        spec={quotesSpec}
        actions={
          <Button variant="quiet" id="preview-quote" onClick={() => setOpen(true)}>
            {quoteDialog.previewLabel}
          </Button>
        }
      />
      <QuoteDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
