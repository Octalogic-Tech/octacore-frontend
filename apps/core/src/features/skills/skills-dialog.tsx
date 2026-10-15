import { PlannedDialog, type PlannedDialogToggle } from '@/features/planned/planned-dialog';
import { skillsDialog } from './spec';

export function SkillsDialog(props: PlannedDialogToggle) {
  return <PlannedDialog {...props} spec={skillsDialog} fallbackFocusId="preview-skills" />;
}
