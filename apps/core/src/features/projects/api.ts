import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coreApi, unwrap } from '@/lib/core-api';
import { projectRowsSchema, type InvoiceBody, type ProjectBody } from './schema';

// The list and a project's own page sit under one prefix, so a change refetches both.
const PROJECTS = ['projects'] as const;
const PROJECT_LIST = [...PROJECTS, 'list'] as const;
const INVOICES = ['invoices'] as const;

export function useProjects() {
  return useQuery({
    queryKey: PROJECT_LIST,
    queryFn: async () => unwrap((await coreApi.get('/projects')).data, projectRowsSchema),
  });
}

/**
 * Adds the project (no id) or edits it. A create answer is not read: nothing here needs the new id, and a schema
 * mismatch on a saved row must never look like a failed save (a retry would add the project twice).
 */
export function useSaveProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number | undefined; body: ProjectBody }) => {
      if (id === undefined) await coreApi.post('/projects', body);
      else await coreApi.patch(`/projects/${id}`, body);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: PROJECTS }),
  });
}

/**
 * The service soft-deletes the project's invoices with it, so only the project is deleted from here. Only the list is
 * refetched: the deleted project's own page would answer 404, and nothing shows it any more.
 */
export function useDeleteProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await coreApi.delete(`/projects/${id}`);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: PROJECT_LIST, exact: true }),
  });
}

/** An invoice change moves its project's totals, so the projects are refetched along with the invoices. */
function useRefreshInvoicesAndProjects() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: INVOICES }),
      client.invalidateQueries({ queryKey: PROJECTS }),
    ]);
}

/** Adds the invoice to the project (no id) or edits it. A create answer is not read, for the reason given above. */
export function useSaveInvoice(projectId: number) {
  const refresh = useRefreshInvoicesAndProjects();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number | undefined; body: InvoiceBody }) => {
      if (id === undefined) await coreApi.post('/invoices', { projectId, ...body });
      else await coreApi.patch(`/invoices/${id}`, body);
    },
    onSuccess: refresh,
  });
}
