import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coreApi, statusOf, unwrap } from '@/lib/core-api';
import { leaveRowsSchema, type LeaveBody } from './schema';

// Every list sits under this prefix, so a write refreshes them all: the register reads every leave, and a person's page
// reads only theirs. The people page marks this key stale too (features/people/api.ts).
const LEAVES = ['leaves'] as const;

export interface LeaveFilter {
  personId?: number;
}

/**
 * The leaves, newest first as the service sends them: all of them for the register, or only one person's. The service
 * filters, so a person's page never loads everyone else's.
 */
export function useLeaves(filter?: LeaveFilter) {
  return useQuery({
    queryKey: [...LEAVES, filter ?? {}] as const,
    queryFn: async () => unwrap((await coreApi.get('/leaves', { params: filter })).data, leaveRowsSchema),
  });
}

function useRefreshLeaves() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: LEAVES });
}

/**
 * Adds the leave (no id) or edits it. The answer is not read: once the service has saved, a schema mismatch on the
 * returned row must not look like a failed save (a retry would add the leave twice, and the service would refuse the
 * second as overlapping the first). An edit leaves the person out: the person of a leave cannot change, and the
 * service refuses a body that names one.
 */
export function useSaveLeave() {
  const refresh = useRefreshLeaves();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: number; body: LeaveBody }) => {
      if (id === undefined) await coreApi.post('/leaves', body);
      else {
        const { startDate, endDate, leaveType, reason } = body;
        await coreApi.patch(`/leaves/${id}`, { startDate, endDate, leaveType, reason });
      }
    },
    onSuccess: refresh,
  });
}

/** A delete that finds the leave already gone has reached the state the person asked for, so it is not a failure. */
export function useDeleteLeave() {
  const refresh = useRefreshLeaves();
  return useMutation({
    mutationFn: async (id: number) => {
      try {
        await coreApi.delete(`/leaves/${id}`);
      } catch (error) {
        if (statusOf(error) !== 404) throw error;
      }
    },
    onSuccess: refresh,
  });
}
