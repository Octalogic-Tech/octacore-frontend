import { useQuery } from '@tanstack/react-query';
import { coreApi, unwrap } from '@/lib/core-api';
import { countriesSchema } from './schema';

export function useCountries() {
  return useQuery({
    queryKey: ['countries'] as const,
    queryFn: async () => unwrap((await coreApi.get('/countries')).data, countriesSchema),
  });
}
