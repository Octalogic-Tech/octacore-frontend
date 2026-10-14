import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export function useUpdateTechnology() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: TechnologyChanges & { id: number }) => {
      await coreApi.patch(`/technologies/${id}`, input);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: technologiesKey }),
  });
}

export function useDeleteTechnology() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await coreApi.delete(`/technologies/${id}`);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: technologiesKey }),
  });
}
