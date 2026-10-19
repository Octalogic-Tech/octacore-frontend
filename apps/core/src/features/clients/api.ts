import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { coreApi, unwrap } from '@/lib/core-api';
import {
  clientRowsSchema,
  contactRowsSchema,
  type ClientBody,
  type ClientRow,
  type ContactRow,
  type ContactStep,
} from './schema';

export const CLIENTS = ['clients'] as const;
const CONTACTS = ['client-contacts'] as const;

// Only the id is read from a created client: once the service has saved it, a schema mismatch on the rest of the
// row must not look like a failed save (a retry would add the client twice).
const createdSchema = z.object({ id: z.number().int() });

export function useClients() {
  return useQuery({
    queryKey: CLIENTS,
    queryFn: async () => unwrap((await coreApi.get('/clients')).data, clientRowsSchema),
  });
}

export function useClientContacts() {
  return useQuery({
    queryKey: CONTACTS,
    queryFn: async () => unwrap((await coreApi.get('/client-contacts')).data, contactRowsSchema),
  });
}

export type ListState = 'loading' | 'ready' | 'failed';

function listState(query: { data: unknown; isError: boolean }): ListState {
  // Data from an earlier fetch still counts as ready if a refetch fails.
  if (query.data !== undefined) return 'ready';
  return query.isError ? 'failed' : 'loading';
}

/**
 * A project's client and that client's contact, read from the two lists the app already loads. A client has at most one
 * live contact, so matching on the client's id is exact. Each list reports its own state, so a failed request is not
 * mistaken for "none".
 */
export function useClientDetails(clientId: number | null) {
  const clients = useClients();
  const contacts = useClientContacts();
  const client: ClientRow | null =
    clientId === null ? null : ((clients.data ?? []).find((row) => row.id === clientId) ?? null);
  const contact: ContactRow | null =
    clientId === null ? null : ((contacts.data ?? []).find((row) => row.clientId === clientId) ?? null);
  return { client, contact, clientsState: listState(clients), contactsState: listState(contacts) };
}

/**
 * The service answers 409 to a second live contact for a client and 404 to a contact that is gone. Saving the same
 * contact again repeats the same call, so a retry cannot succeed: the person has to reopen the client.
 */
export function contactChangedElsewhere(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  return status === 404 || status === 409;
}

/** A change to either list can change the table, so both are refetched. */
function useRefreshLists() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: CLIENTS }),
      client.invalidateQueries({ queryKey: CONTACTS }),
    ]);
}

/** Adds the client (no id) or edits it, and answers with the id the service holds it under. */
export function useSaveClient() {
  const refresh = useRefreshLists();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number | undefined; body: ClientBody }) => {
      if (id === undefined) return unwrap((await coreApi.post('/clients', body)).data, createdSchema).id;
      await coreApi.patch(`/clients/${id}`, body);
      return id;
    },
    onSuccess: refresh,
  });
}

export function useSaveContact() {
  const refresh = useRefreshLists();
  return useMutation({
    mutationFn: async (step: ContactStep) => {
      if (step.kind === 'create') await coreApi.post('/client-contacts', { clientId: step.clientId, ...step.fields });
      else if (step.kind === 'update') await coreApi.patch(`/client-contacts/${step.id}`, step.fields);
      else await coreApi.delete(`/client-contacts/${step.id}`);
    },
    onSuccess: refresh,
  });
}

/** The service soft-deletes the client's contact with it, so only the client is deleted from here. */
export function useDeleteClient() {
  const refresh = useRefreshLists();
  return useMutation({
    mutationFn: async (id: number) => {
      await coreApi.delete(`/clients/${id}`);
    },
    onSuccess: refresh,
  });
}
