import { PlannedDialog, type PlannedDialogToggle } from '@/features/planned/planned-dialog';
import { expenseDialog } from './spec';

export function ExpenseDialog(props: PlannedDialogToggle) {
  return <PlannedDialog {...props} spec={expenseDialog} fallbackFocusId="preview-expense" />;
}
