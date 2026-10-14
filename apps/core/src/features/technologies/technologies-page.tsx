import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { SearchField } from '@/components/search-field';
import { TablePager } from '@/components/table-pager';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Panel } from '@/components/ui/panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePagedRows } from '@/hooks/use-paged-rows';
import { filterBy } from '@/lib/filter';
import { useDeleteTechnology, useTechnologies } from './api';
import { TechnologyFormDialog } from './technology-form-dialog';
import type { Technology } from './types';

export function TechnologiesPage() {
  const { data, isLoading, isError, refetch } = useTechnologies();
  const remove = useDeleteTechnology();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<{ open: boolean; technology?: Technology }>({ open: false });
  const [toDelete, setToDelete] = useState<Technology | null>(null);

  const filtered = useMemo(() => filterBy(data ?? [], search, ['name', 'category', 'description']), [data, search]);
  const paging = usePagedRows(filtered);

  return (
    <>
      <PageHeader title="Technologies">
        <Button onClick={() => setForm({ open: true })}>Add technology</Button>
      </PageHeader>

      <div className="mb-6">
        <SearchField
          id="technology-search"
          label="Search technologies"
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
              <p className="text-body">No technologies yet.</p>
              <Button variant="quiet" onClick={() => setForm({ open: true })}>
                Add the first technology
              </Button>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <p className="p-6 text-body">No technologies match “{search.trim()}”.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paging.pageRows.map((technology) => (
                    <TableRow key={technology.id}>
                      <TableCell className="font-semibold">{technology.name}</TableCell>
                      <TableCell>{technology.category || '—'}</TableCell>
                      <TableCell className="min-w-[16rem]">{technology.description}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Button
                          variant="quiet"
                          aria-label={`Edit ${technology.name}`}
                          onClick={() => setForm({ open: true, technology })}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="quiet"
                          aria-label={`Delete ${technology.name}`}
                          onClick={() => setToDelete(technology)}
                        >
                          Delete
                        </Button>
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

      <TechnologyFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        technology={form.technology}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={`Delete technology “${toDelete?.name ?? ''}”?`}
        description="This cannot be undone."
        confirmLabel="Delete technology"
        fallbackFocusId="technology-search"
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id);
        }}
      />
    </>
  );
}
