import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlannedFeature } from '@/features/planned/planned-feature';
import { TaxRateDialog } from './tax-rate-dialog';
import { currencyTaxSpec, taxRateDialog } from './spec';

/** Skeleton: describes the page and previews its dialog. Replace it with the real page when this is picked up. */
export function CurrencyTaxPage() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PlannedFeature
        spec={currencyTaxSpec}
        actions={
          <Button variant="quiet" id="preview-tax-rate" onClick={() => setOpen(true)}>
            {taxRateDialog.previewLabel}
          </Button>
        }
      />
      <TaxRateDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
