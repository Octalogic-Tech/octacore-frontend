import { PlannedDialog, type PlannedDialogToggle } from '@/features/planned/planned-dialog';
import { allocateDialog } from './spec';

export function AllocateDialog(props: PlannedDialogToggle) {
  return <PlannedDialog {...props} spec={allocateDialog} fallbackFocusId="preview-allocate" />;
}
