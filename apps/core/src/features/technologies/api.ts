import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TechnologyInput } from './schema';
import type { Technology } from './types';

const KEY = ['technologies'] as const;

export function useTechnologies() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<Technology[]>('/technologies')).data,
  });
}

export function useCreateTechnology() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: TechnologyInput) => (await api.post<Technology>('/technologies', input)).data,
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateTechnology() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: TechnologyInput & { id: number }) =>
      (await api.patch<Technology>(`/technologies/${id}`, input)).data,
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTechnology() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/technologies/${id}`);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}
