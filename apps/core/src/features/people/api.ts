import { useQuery } from '@tanstack/react-query';
import { coreApi, unwrap } from '@/lib/core-api';
import { personRowsSchema } from './schema';

/** Read-only: there is no People page yet, so this only feeds the picker on a project's resource form. */
export function usePeople() {
  return useQuery({
    queryKey: ['people'] as const,
    queryFn: async () => unwrap((await coreApi.get('/people')).data, personRowsSchema),
  });
}
