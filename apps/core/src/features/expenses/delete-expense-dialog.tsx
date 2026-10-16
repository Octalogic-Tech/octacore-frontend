import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useDeleteExpense } from './api';
import type { ExpenseRow } from './schema';

interface DeleteExpenseDialogProps {
  /** The expense to delete; null keeps the dialog closed. */
  expense: ExpenseRow | null;
  onClose: () => void;
  /** Where focus goes on close if the row that opened the dialog is gone. */
  fallbackFocusId: string;
}

/** Asks before deleting an expense. A charge a recurring expense made is not made again, and the question says so. */
export function DeleteExpenseDialog({ expense, onClose, fallbackFocusId }: DeleteExpenseDialogProps) {
  const remove = useDeleteExpense();
  const generated = expense !== null && expense.recurringExpenseId !== null;
  return (
    <ConfirmDialog
      open={expense !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Delete expense “${expense?.name ?? ''}”?`}
      description={generated ? 'This cannot be undone. The charge is not created again.' : 'This cannot be undone.'}
      confirmLabel="Delete expense"
      fallbackFocusId={fallbackFocusId}
      onConfirm={async () => {
        if (expense) await remove.mutateAsync(expense.id);
      }}
    />
  );
}
