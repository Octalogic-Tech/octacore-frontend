import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PEOPLE } from '@/features/people/api';
import { coreApi, unwrap } from '@/lib/core-api';
import { technologyRowsSchema, type TechnologyChanges } from './schema';

export const technologiesKey = ['technologies'] as const;

export function useTechnologies() {
  return useQuery({
    queryKey: technologiesKey,
    queryFn: async () => unwrap((await coreApi.get('/technologies')).data, technologyRowsSchema),
  });
}

export function useCreateTechnology() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: TechnologyChanges) => {
      await coreApi.post('/technologies', input);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: technologiesKey }),
  });
}

/**
 * A person holds their technologies by name and the person form ticks them by id, so a technology that is renamed or
 * deleted leaves the people (their list and their own pages, which share the key's prefix) stale: the old name shows,
 * and a deleted technology stays ticked, which the service refuses on save. A new technology is known by nobody yet.
 */
function useRefreshAfterChange() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: technologiesKey }),
      client.invalidateQueries({ queryKey: PEOPLE }),
    ]);
}

export function useUpdateTechnology() {
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: async ({ id, ...input }: TechnologyChanges & { id: number }) => {
      await coreApi.patch(`/technologies/${id}`, input);
    },
    onSuccess: refresh,
  });
}

export function useDeleteTechnology() {
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: async (id: number) => {
      await coreApi.delete(`/technologies/${id}`);
    },
    onSuccess: refresh,
  });
}
