import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coreApi, unwrap } from '@/lib/core-api';
import { personRowsSchema, type PersonBody } from './schema';

const PEOPLE = ['people'] as const;
// The key the project pages hold resources under (features/projects/api.ts).
const PROJECT_RESOURCES = ['project-resources'] as const;
// The keys the allocation ledger and the leave register are held under. Each row embeds the name of its person.
const ALLOCATIONS = ['allocations'] as const;
const LEAVES = ['leaves'] as const;

/** Feeds the People page, the picker on a project's resource form, and the board and the entry forms of Allocation. */
export function usePeople() {
  return useQuery({
    queryKey: PEOPLE,
    queryFn: async () => unwrap((await coreApi.get('/people')).data, personRowsSchema),
  });
}

/**
 * The list is refetched. Each project resource carries the name of its person, and the service unlinks a deleted
 * person from theirs; the same goes for the name in each allocation entry and leave, which the service deletes with a
 * deleted person. Those lists are not on this page, so they are only marked stale, for the next time they are opened.
 */
function useRefreshPeople() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: PEOPLE }),
      client.invalidateQueries({ queryKey: PROJECT_RESOURCES, refetchType: 'none' }),
      client.invalidateQueries({ queryKey: ALLOCATIONS, refetchType: 'none' }),
      client.invalidateQueries({ queryKey: LEAVES, refetchType: 'none' }),
    ]);
}

/**
 * Adds the person (no id) or edits them. The answer is not read: once the service has saved, a schema mismatch on
 * the returned row must not look like a failed save (a retry would add the person twice).
 */
export function useSavePerson() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number | undefined; body: PersonBody }) => {
      if (id === undefined) await coreApi.post('/people', body);
      else await coreApi.patch(`/people/${id}`, body);
    },
    onSuccess: refresh,
  });
}

export function useDeletePerson() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: async (id: number) => {
      await coreApi.delete(`/people/${id}`);
    },
    onSuccess: refresh,
  });
}
