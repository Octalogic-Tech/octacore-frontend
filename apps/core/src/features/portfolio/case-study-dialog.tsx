import { PlannedDialog, type PlannedDialogToggle } from '@/features/planned/planned-dialog';
import { caseStudyDialog } from './spec';

export function CaseStudyDialog(props: PlannedDialogToggle) {
  return <PlannedDialog {...props} spec={caseStudyDialog} fallbackFocusId="preview-case-study" />;
}
