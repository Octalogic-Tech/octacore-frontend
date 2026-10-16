import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EXPENSES_KEY, RECURRING_KEY } from '@/features/expenses/api';
import { coreApi, unwrap } from '@/lib/core-api';
import { expenseTypeRowsSchema, type ExpenseTypeBody } from './schema';

export const EXPENSE_TYPES_KEY = ['expense-types'] as const;

/** Feeds the Expense types page, and the type pickers on the expense and recurring forms. */
export function useExpenseTypes() {
  return useQuery({
    queryKey: EXPENSE_TYPES_KEY,
    queryFn: async () => unwrap((await coreApi.get('/expense-types')).data, expenseTypeRowsSchema),
  });
}

/** An expense and a recurring expense carry their type's name, so a rename or a delete makes those lists stale too. */
function useRefresh() {
  const client = useQueryClient();
  return () =>
    Promise.all(
      [EXPENSE_TYPES_KEY, EXPENSES_KEY, RECURRING_KEY].map((queryKey) => client.invalidateQueries({ queryKey })),
    );
}

/** Adds the type (no id) or edits it. The answer is not read: once saved, a retry would add it twice. */
export function useSaveExpenseType() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number | undefined; body: ExpenseTypeBody }) => {
      if (id === undefined) await coreApi.post('/expense-types', body);
      else await coreApi.patch(`/expense-types/${id}`, body);
    },
    onSuccess: refresh,
  });
}

export function useDeleteExpenseType() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (id: number) => {
      await coreApi.delete(`/expense-types/${id}`);
    },
    onSuccess: refresh,
  });
}
