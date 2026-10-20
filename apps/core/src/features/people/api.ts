import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coreApi, unwrap } from '@/lib/core-api';
import { personRowSchema, personRowsSchema, type PersonBody } from './schema';

// The list and a person's own page sit under one prefix, so a change refetches both.
export const PEOPLE = ['people'] as const;
const PERSON_LIST = [...PEOPLE, 'list'] as const;
const personDetail = (id: number) => [...PEOPLE, 'detail', id] as const;
// The key the project pages hold resources under (features/projects/api.ts).
const PROJECT_RESOURCES = ['project-resources'] as const;
// The keys the allocation ledger and the leave register are held under. Each row embeds the name of its person.
const ALLOCATIONS = ['allocations'] as const;
const LEAVES = ['leaves'] as const;

/** Feeds the People page, the picker on a project's resource form, and the board and the entry forms of Allocation. */
export function usePeople() {
  return useQuery({
    queryKey: PERSON_LIST,
    queryFn: async () => unwrap((await coreApi.get('/people')).data, personRowsSchema),
  });
}

/** One person, for their own page. The service answers 404 for one that does not exist or was deleted. */
export function usePerson(id: number) {
  return useQuery({
    queryKey: personDetail(id),
    queryFn: async () => unwrap((await coreApi.get(`/people/${id}`)).data, personRowSchema),
  });
}

/**
 * The list and the people's own pages are refetched. A person who was just deleted is the exception: their page would
 * only read a 404, so it is marked stale and left alone, as the page is on its way out (the same as a project's). Each
 * project resource carries the name of its person, and the service unlinks a deleted person from theirs; the same goes
 * for the name in each allocation entry and leave, which the service deletes with a deleted person. Those lists are not
 * on this page, so they are only marked stale, for the next time they are opened.
 */
function useRefreshPeople() {
  const client = useQueryClient();
  return (deleted?: number) =>
    Promise.all([
      deleted === undefined
        ? client.invalidateQueries({ queryKey: PEOPLE })
        : Promise.all([
            client.invalidateQueries({ queryKey: PERSON_LIST, exact: true }),
            client.invalidateQueries({ queryKey: personDetail(deleted), refetchType: 'none' }),
          ]),
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
    onSuccess: () => refresh(),
  });
}

export function useDeletePerson() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: async (id: number) => {
      await coreApi.delete(`/people/${id}`);
    },
    onSuccess: (_data, id) => refresh(id),
  });
}
