import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coreApi, statusOf, unwrap } from '@/lib/core-api';
import { allocationRowsSchema, type AllocationBody, type AllocationRow } from './schema';

// Every list sits under this prefix, so a write refreshes them all: the board and the ledger read every entry, and a
// person's page reads only theirs. The people page marks this key stale too (features/people/api.ts).
const ALLOCATIONS = ['allocations'] as const;

export interface AllocationFilter {
  personId?: number;
  projectId?: number;
}

/**
 * The entries, newest first as the service sends them: all of them for the board and the ledger, or only one person's
 * or one project's. The service filters, so a person's page never loads everyone else's.
 */
export function useAllocations(filter?: AllocationFilter) {
  return useQuery({
    queryKey: [...ALLOCATIONS, filter ?? {}] as const,
    queryFn: async () => unwrap((await coreApi.get('/allocations', { params: filter })).data, allocationRowsSchema),
  });
}

function useRefreshAllocations() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ALLOCATIONS });
}

/** What the form saves as an entry: the card is a number (a new card goes through `useAddCard`, which numbers it). */
export type EntryBody = Omit<AllocationBody, 'card'> & { card: number };

/**
 * Adds the entry (no id) or edits it. The answer is not read: once the service has saved, a schema mismatch on the
 * returned row must not look like a failed save (a retry would add the entry twice, and the service would refuse the
 * second as a clash on the date). An edit leaves the person and the card out: neither can change, and the service
 * refuses a body that names one.
 *
 * An edit names the project, and whether the card is removed, only when they are not the entry's own (`current`): the
 * service checks every key of the body against the live records, so naming a project that was deleted since the entry
 * was written would be refused even by an edit of the note or the date, and an omitted key is left as it is. Without
 * `current` both are always named.
 */
export function useSaveAllocation() {
  const refresh = useRefreshAllocations();
  return useMutation({
    mutationFn: async ({
      id,
      body,
      current,
    }: {
      id?: number;
      body: EntryBody;
      current?: Pick<AllocationRow, 'projectId' | 'removed'>;
    }) => {
      if (id === undefined) await coreApi.post('/allocations', body);
      else {
        const { projectId, removed, effectiveDate, note } = body;
        await coreApi.patch(`/allocations/${id}`, {
          ...(projectId === current?.projectId ? {} : { projectId }),
          ...(removed === current?.removed ? {} : { removed }),
          effectiveDate,
          note,
        });
      }
    },
    onSuccess: refresh,
  });
}

/** A delete that finds the entry already gone has reached the state the person asked for, so it is not a failure. */
export function useDeleteAllocation() {
  const refresh = useRefreshAllocations();
  return useMutation({
    mutationFn: async (id: number) => {
      try {
        await coreApi.delete(`/allocations/${id}`);
      } catch (error) {
        if (statusOf(error) !== 404) throw error;
      }
    },
    onSuccess: refresh,
  });
}

/**
 * Puts a card of a person on a project (or the bench, with a null project) from a day: the service sets that day's entry
 * for the card, creating it, or changing its project when the card has one that day. Two moves of a card on one day leave
 * one entry. The answer is not read.
 */
export function useMoveAllocation() {
  const refresh = useRefreshAllocations();
  return useMutation({
    mutationFn: async ({
      personId,
      card,
      projectId,
      effectiveDate,
    }: {
      personId: number;
      card: number;
      projectId: number | null;
      effectiveDate: string;
    }) => {
      await coreApi.post('/allocations/move', { personId, card, projectId, effectiveDate });
    },
    onSuccess: refresh,
  });
}

/**
 * Adds a card to a person from a day, on the project (or the bench) given: the one the card it copies is on. The service
 * numbers it. The answer is not read, and the new card is only seen once the entries are read again.
 */
export function useAddCard() {
  const refresh = useRefreshAllocations();
  return useMutation({
    mutationFn: async ({
      personId,
      projectId,
      effectiveDate,
      note,
    }: {
      personId: number;
      projectId: number | null;
      effectiveDate: string;
      note?: string | null;
    }) => {
      await coreApi.post('/allocations/cards', {
        personId,
        projectId,
        effectiveDate,
        ...(note === undefined ? {} : { note }),
      });
    },
    onSuccess: refresh,
  });
}

/**
 * Removes a card of a person from a day. The service refuses (409) when it is the person's only card. The answer is not
 * read.
 */
export function useRemoveCard() {
  const refresh = useRefreshAllocations();
  return useMutation({
    mutationFn: async ({ personId, card, effectiveDate }: { personId: number; card: number; effectiveDate: string }) => {
      await coreApi.post('/allocations/remove', { personId, card, effectiveDate });
    },
    onSuccess: refresh,
  });
}
