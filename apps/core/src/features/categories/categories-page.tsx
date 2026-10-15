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
import { useCategories, useDeleteCategory } from './api';
import { CategoryFormDialog } from './category-form-dialog';
import type { Category } from './types';

export function CategoriesPage() {
  const { data, isLoading, isError, refetch } = useCategories();
  const remove = useDeleteCategory();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<{ open: boolean; category?: Category }>({ open: false });
  const [toDelete, setToDelete] = useState<Category | null>(null);

  const filtered = useMemo(() => filterBy(data ?? [], search, ['name', 'description']), [data, search]);
  const paging = usePagedRows(filtered);

  return (
    <>
      <PageHeader title="Categories">
        <Button onClick={() => setForm({ open: true })}>Add category</Button>
      </PageHeader>

      <div className="mb-6">
        <SearchField
          id="category-search"
          label="Search categories"
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
              <p className="text-body">No categories yet.</p>
              <Button variant="quiet" onClick={() => setForm({ open: true })}>
                Add the first category
              </Button>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <p className="p-6 text-body">No categories match “{search.trim()}”.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paging.pageRows.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-semibold">{category.name}</TableCell>
                      <TableCell className="tabular">{formatDate(category.createdDate)}</TableCell>
                      <TableCell className="tabular">{formatDate(category.updatedDate)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <IconButton
                          label={`Edit ${category.name}`}
                          icon={LuPencil}
                          onClick={() => setForm({ open: true, category })}
                        />
                        <IconButton
                          label={`Delete ${category.name}`}
                          icon={LuTrash2}
                          onClick={() => setToDelete(category)}
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

      <CategoryFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        category={form.category}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={`Delete category “${toDelete?.name ?? ''}”?`}
        description="This cannot be undone."
        confirmLabel="Delete category"
        fallbackFocusId="category-search"
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id);
        }}
      />
    </>
  );
}
