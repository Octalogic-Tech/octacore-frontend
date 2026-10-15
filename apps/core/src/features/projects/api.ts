import { useQuery } from '@tanstack/react-query';
import { coreApi, unwrap } from '@/lib/core-api';
import { projectRowsSchema } from './schema';

// The list and a project's own page sit under one prefix, so a change refetches both.
const PROJECTS = ['projects'] as const;
const PROJECT_LIST = [...PROJECTS, 'list'] as const;

export function useProjects() {
  return useQuery({
    queryKey: PROJECT_LIST,
    queryFn: async () => unwrap((await coreApi.get('/projects')).data, projectRowsSchema),
  });
}
