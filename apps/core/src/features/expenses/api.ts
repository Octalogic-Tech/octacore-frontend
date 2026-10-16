import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coreApi, unwrap } from '@/lib/core-api';
import {
  expenseRowsSchema,
  recurringRowsSchema,
  type ExpenseBody,
  type RecurringBody,
  type RecurringState,
} from './schema';

// The list, the summary and every filter combination sit under one prefix, so a change refetches them all.
export const EXPENSES_KEY = ['expenses'] as const;
export const RECURRING_KEY = ['recurring-expenses'] as const;

/** What the service takes to narrow the ledger. A blank filter is left out. */
export interface ExpenseQuery {
  expenseTypeId?: number;
  projectId?: number;
  personId?: number;
  from?: string;
  to?: string;
  recurring?: boolean;
  q?: string;
}

/** The rows for these filters. The previous rows stay on screen while a new filter loads. */
export function useExpenses(query: ExpenseQuery) {
  return useQuery({
    queryKey: [...EXPENSES_KEY, 'list', query] as const,
    queryFn: async () => unwrap((await coreApi.get('/expenses', { params: query })).data, expenseRowsSchema),
    placeholderData: keepPreviousData,
  });
}

/**
 * Adds the expense (no id) or edits it. The answer is not read: once the service has saved, a schema mismatch on
 * the returned row must not look like a failed save (a retry would add the expense twice).
 */
export function useSaveExpense() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number | undefined; body: ExpenseBody }) => {
      if (id === undefined) await coreApi.post('/expenses', body);
      else await coreApi.patch(`/expenses/${id}`, body);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: EXPENSES_KEY }),
  });
}

export function useDeleteExpense() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await coreApi.delete(`/expenses/${id}`);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: EXPENSES_KEY }),
  });
}

export function useRecurringExpenses() {
  return useQuery({
    queryKey: RECURRING_KEY,
    queryFn: async () => unwrap((await coreApi.get('/recurring-expenses')).data, recurringRowsSchema),
  });
}

/** A recurring expense saved or changed can have made expenses (or changed their names), so both lists refetch. */
function useRefreshBoth() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: RECURRING_KEY }),
      client.invalidateQueries({ queryKey: EXPENSES_KEY }),
    ]);
}

/**
 * Adds the recurring expense (no id) or edits it. A create answers with how many charges it made at once (a start
 * date in the past fills the ledger); that count is read leniently, so an unexpected answer cannot look like a failed
 * save. An edit resolves to 0.
 */
export function useSaveRecurring() {
  const refresh = useRefreshBoth();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number | undefined; body: RecurringBody }): Promise<number> => {
      if (id !== undefined) {
        await coreApi.patch(`/recurring-expenses/${id}`, body);
        return 0;
      }
      const answer = (await coreApi.post('/recurring-expenses', body)).data as
        | { data?: { generatedCount?: unknown } }
        | undefined;
      const count = answer?.data?.generatedCount;
      return typeof count === 'number' ? count : 0;
    },
    onSuccess: refresh,
  });
}

/** Pauses, resumes or cancels. Resuming on a charge day can make an expense, so both lists refetch. */
export function useChangeRecurringState() {
  const refresh = useRefreshBoth();
  return useMutation({
    mutationFn: async ({ id, state }: { id: number; state: RecurringState }) => {
      await coreApi.patch(`/recurring-expenses/${id}`, { state });
    },
    onSuccess: refresh,
  });
}

/** Deleting stops the expense; the charges it made stay in the ledger. */
export function useDeleteRecurring() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await coreApi.delete(`/recurring-expenses/${id}`);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: RECURRING_KEY }),
  });
}
