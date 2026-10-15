import { PlannedDialog, type PlannedDialogToggle } from '@/features/planned/planned-dialog';
import { scheduleDialog } from './spec';

export function ScheduleDialog(props: PlannedDialogToggle) {
  return <PlannedDialog {...props} spec={scheduleDialog} fallbackFocusId="preview-schedule" />;
}
