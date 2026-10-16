import { PlannedDialog, type PlannedDialogToggle } from '@/features/planned/planned-dialog';
import { taxRateDialog } from './spec';

export function TaxRateDialog(props: PlannedDialogToggle) {
  return <PlannedDialog {...props} spec={taxRateDialog} fallbackFocusId="preview-tax-rate" />;
}
