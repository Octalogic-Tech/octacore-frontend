import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { today } from '@/lib/format';
import type { CategoryInput } from './schema';
import type { Category } from './types';

const KEY = ['categories'] as const;

export function useCategories() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<Category[]>('/categories')).data,
  });
}

export function useCreateCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: CategoryInput) =>
      (await api.post<Category>('/categories', { ...input, created: today(), updated: today() })).data,
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: CategoryInput & { id: number }) =>
      (await api.patch<Category>(`/categories/${id}`, { ...input, updated: today() })).data,
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/categories/${id}`);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}
