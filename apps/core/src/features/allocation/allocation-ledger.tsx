import { useMemo, useState } from 'react';
import { LuPencil, LuTrash2 } from 'react-icons/lu';
import { QueryBoundary } from '@/components/query-boundary';
import { SearchField } from '@/components/search-field';
import { TablePager } from '@/components/table-pager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { IconButton } from '@/components/ui/icon-button';
import { Panel } from '@/components/ui/panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePagedRows } from '@/hooks/use-paged-rows';
import { formatDate, localToday } from '@/lib/format';
import { useAllocations, useDeleteAllocation } from './api';
import { AllocationFormDialog } from './allocation-form-dialog';
import { allocationMatches, type AllocationRow } from './schema';

const NONE = '—';

interface AllocationLedgerProps {
  /** Only this person's entries, on their own page: the Person column and the Person field are left out. */
  personId?: number;
}

/**
 * The ledger: every entry, newest first, each saying "from this date this person is on this project (or the bench)".
 * Entries are added, edited and deleted here, so a date in the past can be filled in. An entry that starts after today is
 * marked Upcoming: it moves nobody yet.
 */
export function AllocationLedger({ personId }: AllocationLedgerProps) {
  const entries = useAllocations(personId === undefined ? undefined : { personId });
  const remove = useDeleteAllocation();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<{ open: boolean; entry?: AllocationRow }>({ open: false });
  const [toDelete, setToDelete] = useState<AllocationRow | null>(null);
  const today = localToday();

  const filtered = useMemo(
    () => (entries.data ?? []).filter((entry) => allocationMatches(entry, search)),
    [entries.data, search],
  );
  const paging = usePagedRows(filtered);

  // Names the row by what it says, since a person may have many.
  const rowName = (entry: AllocationRow) => `${entry.person.name} from ${formatDate(entry.effectiveDate)}`;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <SearchField
          id="allocation-search"
          label="Search entries"
          value={search}
          onChange={(value) => {
            setSearch(value);
            paging.setPage(0);
          }}
        />
        <Button id="add-allocation" variant="quiet" onClick={() => setForm({ open: true })}>
          Add entry
        </Button>
      </div>

      <Panel>
        <QueryBoundary
          isLoading={entries.isLoading}
          isError={entries.isError}
          onRetry={() => void entries.refetch()}
          isEmpty={!entries.data?.length}
          empty={
            <div className="grid justify-items-start gap-1">
              <p className="text-body">
                {personId === undefined ? 'No allocation entries yet.' : 'No allocations for this person yet.'}
              </p>
              <Button variant="quiet" onClick={() => setForm({ open: true })}>
                Add the first entry
              </Button>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <p className="p-6 text-body">No entries match “{search.trim()}”.</p>
          ) : (
            <>
              <Table aria-label="Allocation ledger">
                <TableHeader>
                  <TableRow>
                    <TableHead>From</TableHead>
                    {personId === undefined ? <TableHead>Person</TableHead> : null}
                    <TableHead>Project</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paging.pageRows.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="tabular whitespace-nowrap">
                        {formatDate(entry.effectiveDate)}
                        {entry.effectiveDate > today ? (
                          <Badge variant="outline" className="ml-3">
                            Upcoming
                          </Badge>
                        ) : null}
                      </TableCell>
                      {personId === undefined ? (
                        <TableCell className="font-semibold">{entry.person.name}</TableCell>
                      ) : null}
                      <TableCell>{entry.project?.name ?? 'Bench'}</TableCell>
                      <TableCell className="min-w-[10rem]">{entry.note || NONE}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <IconButton
                          label={`Edit ${rowName(entry)}`}
                          icon={LuPencil}
                          onClick={() => setForm({ open: true, entry })}
                        />
                        <IconButton
                          label={`Delete ${rowName(entry)}`}
                          icon={LuTrash2}
                          onClick={() => setToDelete(entry)}
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

      <AllocationFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        entry={form.entry}
        personId={personId}
        fallbackFocusId="allocation-search"
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={`Delete the entry for “${toDelete?.person.name ?? ''}” from ${toDelete ? formatDate(toDelete.effectiveDate) : ''}?`}
        description={`They were on ${toDelete?.project ? toDelete.project.name : 'the bench'} from that day. Where they are now is worked out again from their other entries. This cannot be undone.`}
        confirmLabel="Delete entry"
        fallbackFocusId="allocation-search"
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id);
        }}
      />
    </>
  );
}
