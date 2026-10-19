import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CLIENTS } from '@/features/clients/api';
import { EXPENSES_KEY, RECURRING_KEY } from '@/features/expenses/api';
import { coreApi, unwrap } from '@/lib/core-api';
import { countriesSchema, syncResultSchema, type CountryBody } from './schema';

export const COUNTRIES_KEY = ['countries'] as const;

/** Feeds the Countries page, the client form's country select and the country pickers on the expense forms. */
export function useCountries() {
  return useQuery({
    queryKey: COUNTRIES_KEY,
    queryFn: async () => unwrap((await coreApi.get('/countries')).data, countriesSchema),
  });
}

/**
 * A recurring expense reads its US cost from its country's current rate, so a change makes that list stale. An
 * expense keeps the rate it was saved with, but its rows embed the country's currency code and symbol, and a client's
 * row its country's name, so those lists refetch too.
 */
function useRefresh() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: COUNTRIES_KEY }),
      client.invalidateQueries({ queryKey: RECURRING_KEY }),
      client.invalidateQueries({ queryKey: EXPENSES_KEY }),
      client.invalidateQueries({ queryKey: CLIENTS }),
    ]);
}

/** Adds the country (no id) or edits it. The answer is not read: once saved, a retry would add it twice. */
export function useSaveCountry() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number | undefined; body: CountryBody }) => {
      if (id === undefined) await coreApi.post('/countries', body);
      else await coreApi.patch(`/countries/${id}`, body);
    },
    onSuccess: refresh,
  });
}

export function useDeleteCountry() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (id: number) => {
      await coreApi.delete(`/countries/${id}`);
    },
    onSuccess: refresh,
  });
}

/**
 * Asks the service to fetch today's rates for the active countries. It is manual: nothing calls it on a schedule.
 * The lists refresh even when the answer cannot be read, because the rates may have changed all the same.
 */
export function useSyncRates() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async () => unwrap((await coreApi.post('/countries/sync-rates')).data, syncResultSchema),
    onSettled: refresh,
  });
}
