import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coreApi, unwrap } from '@/lib/core-api';
import { toCreateBody, toUpdateBody, userRowsSchema, type UserFormValues } from './schema';

export const usersKey = ['users'] as const;

export function useUsers() {
  return useQuery({
    queryKey: usersKey,
    queryFn: async () => unwrap((await coreApi.get('/users')).data, userRowsSchema),
  });
}

export function useCreateUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (values: UserFormValues) => {
      await coreApi.post('/users', toCreateBody(values));
    },
    onSuccess: () => client.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useUpdateUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: number; values: UserFormValues }) => {
      await coreApi.patch(`/users/${id}`, toUpdateBody(values));
    },
    onSuccess: () => client.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useDeleteUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await coreApi.delete(`/users/${id}`);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: usersKey }),
  });
}
