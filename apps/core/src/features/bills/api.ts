import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Bill } from './types';

const KEY = ['bills'] as const;

export function useBills() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<Bill[]>('/bills')).data,
  });
}

export function useCreateBill() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (bill: Omit<Bill, 'id'>) => (await api.post<Bill>('/bills', bill)).data,
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}
