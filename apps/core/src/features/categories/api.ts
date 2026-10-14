import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { technologiesKey } from '@/features/technologies/api';
import { coreApi, unwrap } from '@/lib/core-api';
import { categoryRowsSchema, type CategoryInput } from './schema';

const KEY = ['categories'] as const;

export function useCategories() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => unwrap((await coreApi.get('/categories')).data, categoryRowsSchema),
  });
}

export function useCreateCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: CategoryInput) => {
      await coreApi.post('/categories', input);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

/** A technology carries its category's name, so a rename or a delete makes the technologies stale too. */
export function useUpdateCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: CategoryInput & { id: number }) => {
      await coreApi.patch(`/categories/${id}`, input);
    },
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: KEY }),
        client.invalidateQueries({ queryKey: technologiesKey }),
      ]),
  });
}

export function useDeleteCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await coreApi.delete(`/categories/${id}`);
    },
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: KEY }),
        client.invalidateQueries({ queryKey: technologiesKey }),
      ]),
  });
}
