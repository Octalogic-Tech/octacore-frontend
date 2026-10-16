import { PlannedDialog, type PlannedDialogToggle } from '@/features/planned/planned-dialog';
import { quoteDialog } from './spec';

export function QuoteDialog(props: PlannedDialogToggle) {
  return <PlannedDialog {...props} spec={quoteDialog} fallbackFocusId="preview-quote" />;
}
