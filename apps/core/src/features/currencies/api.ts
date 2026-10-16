import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RECURRING_KEY } from '@/features/expenses/api';
import { coreApi, unwrap } from '@/lib/core-api';
import { currencyRowsSchema, type CurrencyBody } from './schema';

export const CURRENCIES_KEY = ['currencies'] as const;

/** Feeds the Currencies page, and the currency pickers on the expense and recurring forms. */
export function useCurrencies() {
  return useQuery({
    queryKey: CURRENCIES_KEY,
    queryFn: async () => unwrap((await coreApi.get('/currencies')).data, currencyRowsSchema),
  });
}

/**
 * A recurring expense reads its US cost from its currency's current rate, so a change makes that list stale too. The
 * ledger does not: an expense keeps the rate it was saved with.
 */
function useRefresh() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: CURRENCIES_KEY }),
      client.invalidateQueries({ queryKey: RECURRING_KEY }),
    ]);
}

/** Adds the currency (no id) or edits it. The answer is not read: once saved, a retry would add it twice. */
export function useSaveCurrency() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number | undefined; body: CurrencyBody }) => {
      if (id === undefined) await coreApi.post('/currencies', body);
      else await coreApi.patch(`/currencies/${id}`, body);
    },
    onSuccess: refresh,
  });
}

export function useDeleteCurrency() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (id: number) => {
      await coreApi.delete(`/currencies/${id}`);
    },
    onSuccess: refresh,
  });
}
