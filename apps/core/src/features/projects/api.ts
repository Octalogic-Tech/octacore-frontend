import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Project } from './types';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'] as const,
    queryFn: async () => (await api.get<Project[]>('/projects')).data,
  });
}
