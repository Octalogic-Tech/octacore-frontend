import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coreApi, statusOf, unwrap } from '@/lib/core-api';
import { allocationRowsSchema, type AllocationBody } from './schema';

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

/**
 * Adds the entry (no id) or edits it. The answer is not read: once the service has saved, a schema mismatch on the
 * returned row must not look like a failed save (a retry would add the entry twice, and the service would refuse the
 * second as a clash on the date). An edit leaves the person out: the person of an entry cannot change, and the service
 * refuses a body that names one.
 *
 * An edit names the project only when it is not the entry's own (`currentProjectId`, null for the bench): the service
 * checks every key of the body against the live records, so naming a project that was deleted since the entry was
 * written would be refused even by an edit of the note or the date, and an omitted project is left as it is. Without
 * `currentProjectId` the project is always named.
 */
export function useSaveAllocation() {
  const refresh = useRefreshAllocations();
  return useMutation({
    mutationFn: async ({
      id,
      body,
      currentProjectId,
    }: {
      id?: number;
      body: AllocationBody;
      currentProjectId?: number | null;
    }) => {
      if (id === undefined) await coreApi.post('/allocations', body);
      else {
        const { projectId, effectiveDate, note } = body;
        const changes = projectId === currentProjectId ? { effectiveDate, note } : { projectId, effectiveDate, note };
        await coreApi.patch(`/allocations/${id}`, changes);
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
 * Puts a person on a project (or the bench, with a null project) from a day: the service sets that day's entry,
 * creating it, or changing its project when the person already has one that day. Two moves on one day leave one entry.
 * The answer is not read.
 */
export function useMoveAllocation() {
  const refresh = useRefreshAllocations();
  return useMutation({
    mutationFn: async ({
      personId,
      projectId,
      effectiveDate,
    }: {
      personId: number;
      projectId: number | null;
      effectiveDate: string;
    }) => {
      await coreApi.post('/allocations/move', { personId, projectId, effectiveDate });
    },
    onSuccess: refresh,
  });
}
