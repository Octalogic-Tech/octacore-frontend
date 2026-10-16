import { useMemo, useState } from 'react';
import { LuPencil, LuTrash2 } from 'react-icons/lu';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { SearchField } from '@/components/search-field';
import { TablePager } from '@/components/table-pager';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { IconButton } from '@/components/ui/icon-button';
import { Panel } from '@/components/ui/panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePagedRows } from '@/hooks/use-paged-rows';
import { filterBy } from '@/lib/filter';
import { formatDate } from '@/lib/format';
import { useDeleteExpenseType, useExpenseTypes } from './api';
import { ExpenseTypeFormDialog } from './expense-type-form-dialog';
import type { ExpenseTypeRow } from './schema';

export function ExpenseTypesPage() {
  const { data, isLoading, isError, refetch } = useExpenseTypes();
  const remove = useDeleteExpenseType();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<{ open: boolean; expenseType?: ExpenseTypeRow }>({ open: false });
  const [toDelete, setToDelete] = useState<ExpenseTypeRow | null>(null);

  const filtered = useMemo(() => filterBy(data ?? [], search, ['name', 'description']), [data, search]);
  const paging = usePagedRows(filtered);

  return (
    <>
      <PageHeader title="Expense types">
        <Button onClick={() => setForm({ open: true })}>Add expense type</Button>
      </PageHeader>

      <div className="mb-6">
        <SearchField
          id="expense-type-search"
          label="Search expense types"
          value={search}
          onChange={(value) => {
            setSearch(value);
            paging.setPage(0);
          }}
        />
      </div>

      <Panel>
        <QueryBoundary
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
          isEmpty={!data?.length}
          empty={
            <div className="grid justify-items-start gap-1">
              <p className="text-body">No expense types yet.</p>
              <Button variant="quiet" onClick={() => setForm({ open: true })}>
                Add the first expense type
              </Button>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <p className="p-6 text-body">No expense types match “{search.trim()}”.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paging.pageRows.map((expenseType) => (
                    <TableRow key={expenseType.id}>
                      <TableCell className="font-semibold">{expenseType.name}</TableCell>
                      <TableCell>{expenseType.description}</TableCell>
                      <TableCell className="tabular">{formatDate(expenseType.createdDate)}</TableCell>
                      <TableCell className="tabular">{formatDate(expenseType.updatedDate)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <IconButton
                          label={`Edit ${expenseType.name}`}
                          icon={LuPencil}
                          onClick={() => setForm({ open: true, expenseType })}
                        />
                        <IconButton
                          label={`Delete ${expenseType.name}`}
                          icon={LuTrash2}
                          onClick={() => setToDelete(expenseType)}
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

      <ExpenseTypeFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        expenseType={form.expenseType}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={`Delete expense type “${toDelete?.name ?? ''}”?`}
        description="This cannot be undone. An expense type that an expense uses cannot be deleted."
        confirmLabel="Delete expense type"
        fallbackFocusId="expense-type-search"
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id);
        }}
      />
    </>
  );
}
