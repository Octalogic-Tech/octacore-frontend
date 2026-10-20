import { useMemo, useState } from 'react';
import { LuPencil, LuTrash2 } from 'react-icons/lu';
import { QueryBoundary } from '@/components/query-boundary';
import { SearchField } from '@/components/search-field';
import { TablePager } from '@/components/table-pager';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { IconButton } from '@/components/ui/icon-button';
import { Panel } from '@/components/ui/panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePagedRows } from '@/hooks/use-paged-rows';
import { formatDate } from '@/lib/format';
import { useDeleteLeave, useLeaves } from './api';
import { LeaveFormDialog } from './leave-form-dialog';
import { LEAVE_TYPES, leaveDates, leaveMatches, type LeaveRow } from './schema';

const NONE = '—';

const typeLabel = (row: LeaveRow) => LEAVE_TYPES.find((type) => type.value === row.leaveType)?.label ?? row.leaveType;

interface LeaveTableProps {
  /** Only this person's leaves, on their own page: the Person column and the Person field are left out. */
  personId?: number;
}

/**
 * The leave register: every leave, newest first, with its first and last day, who took it, what kind it was and why.
 * Leaves are added, edited and deleted here. There is no approval and no count of days: it is a record of who was away
 * and when.
 */
export function LeaveTable({ personId }: LeaveTableProps) {
  const leaves = useLeaves(personId === undefined ? undefined : { personId });
  const remove = useDeleteLeave();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<{ open: boolean; leave?: LeaveRow }>({ open: false });
  const [toDelete, setToDelete] = useState<LeaveRow | null>(null);

  const filtered = useMemo(
    () => (leaves.data ?? []).filter((leave) => leaveMatches(leave, search)),
    [leaves.data, search]
  );
  const paging = usePagedRows(filtered);

  // Names the row by what it says, since a person may have many. Their leaves cannot overlap, so a first day is unique.
  const rowName = (leave: LeaveRow) => `${leave.person.name} from ${formatDate(leave.startDate)}`;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <SearchField
          id="leave-search"
          label="Search leave"
          value={search}
          onChange={(value) => {
            setSearch(value);
            paging.setPage(0);
          }}
        />
        <Button id="add-leave" variant="quiet" onClick={() => setForm({ open: true })}>
          Add leave
        </Button>
      </div>

      <Panel>
        <QueryBoundary
          isLoading={leaves.isLoading}
          isError={leaves.isError}
          onRetry={() => void leaves.refetch()}
          isEmpty={!leaves.data?.length}
          empty={
            <div className="grid justify-items-start gap-1">
              <p className="text-body">
                {personId === undefined ? 'No leave recorded yet.' : 'No leave recorded for this person yet.'}
              </p>
              <Button variant="quiet" onClick={() => setForm({ open: true })}>
                Add the first leave
              </Button>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <p className="p-6 text-body">No leave matches “{search.trim()}”.</p>
          ) : (
            <>
              <Table aria-label="Leave">
                <TableHeader>
                  <TableRow>
                    <TableHead>Dates</TableHead>
                    {personId === undefined ? <TableHead>Person</TableHead> : null}
                    <TableHead>Type</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paging.pageRows.map((leave) => (
                    <TableRow key={leave.id}>
                      <TableCell className="tabular whitespace-nowrap">{leaveDates(leave)}</TableCell>
                      {personId === undefined ? (
                        <TableCell className="font-semibold">{leave.person.name}</TableCell>
                      ) : null}
                      <TableCell>{typeLabel(leave)}</TableCell>
                      <TableCell className="min-w-[10rem]">{leave.reason || NONE}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <IconButton
                          label={`Edit ${rowName(leave)}`}
                          icon={LuPencil}
                          onClick={() => setForm({ open: true, leave })}
                        />
                        <IconButton
                          label={`Delete ${rowName(leave)}`}
                          icon={LuTrash2}
                          onClick={() => setToDelete(leave)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePager
                page={paging.page}
                pageCount={paging.pageCount}
                pageSize={paging.pageSize}
                total={paging.total}
                onPageChange={paging.setPage}
                onPageSizeChange={paging.setPageSize}
              />
            </>
          )}
        </QueryBoundary>
      </Panel>

      <LeaveFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        leave={form.leave}
        personId={personId}
        fallbackFocusId="leave-search"
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={`Delete the leave of “${toDelete?.person.name ?? ''}”, ${toDelete ? leaveDates(toDelete) : ''}?`}
        description="This cannot be undone."
        confirmLabel="Delete leave"
        fallbackFocusId="leave-search"
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id);
        }}
      />
    </>
  );
}
