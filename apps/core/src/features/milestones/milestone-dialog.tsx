import { PlannedDialog, type PlannedDialogToggle } from '@/features/planned/planned-dialog';
import { milestoneDialog } from './spec';

export function MilestoneDialog(props: PlannedDialogToggle) {
  return <PlannedDialog {...props} spec={milestoneDialog} fallbackFocusId="preview-milestone" />;
}
