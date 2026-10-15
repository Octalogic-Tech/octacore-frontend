import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coreApi, statusOf, unwrap } from '@/lib/core-api';
import {
  emailDraftSchema,
  invoiceDraftSchema,
  invoiceRowsSchema,
  nextNumberSchema,
  projectRowSchema,
  projectRowsSchema,
  resourceRowsSchema,
  type InvoiceBody,
  type ProjectBody,
  type ResourceBody,
  type SendBody,
} from './schema';

// The list and a project's own page sit under one prefix, so a change refetches both.
const PROJECTS = ['projects'] as const;
const PROJECT_LIST = [...PROJECTS, 'list'] as const;
const INVOICES = ['invoices'] as const;
const RESOURCES = ['project-resources'] as const;
const DRAFT = ['invoice-draft'] as const;

export function useProjects() {
  return useQuery({
    queryKey: PROJECT_LIST,
    queryFn: async () => unwrap((await coreApi.get('/projects')).data, projectRowsSchema),
  });
}

export function useProject(id: number) {
  return useQuery({
    queryKey: [...PROJECTS, 'detail', id] as const,
    queryFn: async () => unwrap((await coreApi.get(`/projects/${id}`)).data, projectRowSchema),
  });
}

/** Only this project's invoices: the service filters them, so the page never loads everyone else's. */
export function useInvoices(projectId: number) {
  return useQuery({
    queryKey: [...INVOICES, { projectId }] as const,
    queryFn: async () =>
      unwrap((await coreApi.get('/invoices', { params: { projectId } })).data, invoiceRowsSchema),
  });
}

/** Only this project's resources: the service filters them. */
export function useProjectResources(projectId: number) {
  return useQuery({
    queryKey: [...RESOURCES, { projectId }] as const,
    queryFn: async () =>
      unwrap((await coreApi.get('/project-resources', { params: { projectId } })).data, resourceRowsSchema),
  });
}

/**
 * The lines a new invoice would start with. A snapshot taken when the editor opens: it is never kept (`gcTime: 0`),
 * always refetched on mount, and never refetched on focus, so reopening shows the resources as they are now and a
 * background refetch cannot overwrite lines the person is editing.
 */
export function useInvoiceDraft(projectId: number, enabled: boolean) {
  return useQuery({
    queryKey: [...DRAFT, { projectId }] as const,
    queryFn: async () => unwrap((await coreApi.get(`/projects/${projectId}/invoice-draft`)).data, invoiceDraftSchema),
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/** Informs the Number field of the invoice form; nothing is reserved. Asked again for every issue date. */
export function useNextInvoiceNumber(projectId: number, issueDate: string, enabled: boolean) {
  return useQuery({
    queryKey: ['next-invoice-number', { projectId, issueDate }] as const,
    queryFn: async () =>
      unwrap(
        (await coreApi.get(`/projects/${projectId}/next-invoice-number`, { params: { issueDate } })).data,
        nextNumberSchema,
      ),
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}

/** A delete that finds the record already gone has reached the state the person asked for, so it is not a failure. */
async function deleteRecord(path: string) {
  try {
    await coreApi.delete(path);
  } catch (error) {
    if (statusOf(error) !== 404) throw error;
  }
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

/** Adds the resource to the project (no id) or edits it. A create answer is not read, for the reason given above. */
export function useSaveResource(projectId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number | undefined; body: ResourceBody }) => {
      if (id === undefined) await coreApi.post('/project-resources', { projectId, ...body });
      else await coreApi.patch(`/project-resources/${id}`, body);
    },
    // Nothing else on the page depends on a resource: an invoice keeps its own copy of the lines it was built from.
    onSuccess: () => client.invalidateQueries({ queryKey: RESOURCES }),
  });
}

export function useDeleteResource() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteRecord(`/project-resources/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: RESOURCES }),
  });
}

/**
 * The service soft-deletes the project's invoices and resources with it, so only the project is deleted from here. The list is
 * refetched. The project's own page and its invoices are only marked stale, without a refetch: the page showing them is
 * about to go and would be told 404, but going back to it later must ask again instead of showing the deleted project
 * from the cache.
 */
export function useDeleteProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteRecord(`/projects/${id}`),
    onSuccess: (_data, id) =>
      Promise.all([
        client.invalidateQueries({ queryKey: PROJECT_LIST, exact: true }),
        client.invalidateQueries({ queryKey: [...PROJECTS, 'detail', id], refetchType: 'none' }),
        client.invalidateQueries({ queryKey: [...INVOICES, { projectId: id }], refetchType: 'none' }),
        client.invalidateQueries({ queryKey: [...RESOURCES, { projectId: id }], refetchType: 'none' }),
      ]),
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

/**
 * Marks an invoice paid on a date, or unpaid with null. Refetches whether or not it worked: if the invoice was removed
 * elsewhere, the failure should leave the table showing what is really there.
 */
export function useSetInvoicePaid() {
  const refresh = useRefreshInvoicesAndProjects();
  return useMutation({
    mutationFn: async ({ id, paidDate }: { id: number; paidDate: string | null }) => {
      await coreApi.patch(`/invoices/${id}`, { paidDate });
    },
    onSettled: refresh,
  });
}

export function useDeleteInvoice() {
  const refresh = useRefreshInvoicesAndProjects();
  return useMutation({
    mutationFn: (id: number) => deleteRecord(`/invoices/${id}`),
    onSuccess: refresh,
  });
}

/** The PDF the service draws for an invoice, as a blob: a plain link would carry no sign-in token. */
export async function fetchInvoicePdf(id: number): Promise<Blob> {
  const response = await coreApi.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
  return response.data as Blob;
}

/** The email the dialog starts from. Never kept, so reopening asks again. */
export function useEmailDraft(invoiceId: number) {
  return useQuery({
    queryKey: ['email-draft', invoiceId] as const,
    queryFn: async () => unwrap((await coreApi.get(`/invoices/${invoiceId}/email-draft`)).data, emailDraftSchema),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

/**
 * Sends the invoice's PDF. The answer is not read: once the email has gone, a schema mismatch must never look like a
 * failed send (a retry would send it twice).
 */
export function useSendInvoice() {
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: SendBody }) => {
      await coreApi.post(`/invoices/${id}/send`, body);
    },
  });
}
