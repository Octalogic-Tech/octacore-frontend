import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { SearchField } from '@/components/search-field';
import { TablePager } from '@/components/table-pager';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Panel } from '@/components/ui/panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/features/auth/auth-context';
import { usePagedRows } from '@/hooks/use-paged-rows';
import { filterBy } from '@/lib/filter';
import { formatDate } from '@/lib/format';
import { useDeleteUser, useUsers } from './api';
import type { User } from './types';
import { UserFormDialog } from './user-form-dialog';

export function UsersPage() {
  const { user: me } = useAuth();
  const { data, isLoading, isError, refetch } = useUsers();
  const remove = useDeleteUser();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<{ open: boolean; user?: User }>({ open: false });
  const [toDelete, setToDelete] = useState<User | null>(null);

  const filtered = useMemo(() => filterBy(data ?? [], search, ['name', 'email', 'role']), [data, search]);
  const paging = usePagedRows(filtered);

  return (
    <>
      <PageHeader title="Users">
        <Button onClick={() => setForm({ open: true })}>Add user</Button>
      </PageHeader>

      <div className="mb-6">
        <SearchField
          id="user-search"
          label="Search users"
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
              <p className="text-body">No users yet.</p>
              <Button variant="quiet" onClick={() => setForm({ open: true })}>
                Add the first user
              </Button>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <p className="p-6 text-body">No users match “{search.trim()}”.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Last sign-in</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paging.pageRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-semibold">{row.name}</TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>{row.role}</TableCell>
                      <TableCell className="tabular">{row.lastLoginDate ? formatDate(row.lastLoginDate) : 'Never'}</TableCell>
                      <TableCell className="tabular">{formatDate(row.createdDate)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Button variant="quiet" aria-label={`Edit ${row.name}`} onClick={() => setForm({ open: true, user: row })}>
                          Edit
                        </Button>
                        <Button
                          variant="quiet"
                          aria-label={`Delete ${row.name}`}
                          // The service refuses it too (409); this just does not offer it.
                          disabled={row.id === me?.id}
                          onClick={() => setToDelete(row)}
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

      <UserFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        user={form.user}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={`Delete user “${toDelete?.name ?? ''}”?`}
        description="They are signed out at once and cannot sign in again."
        confirmLabel="Delete user"
        fallbackFocusId="user-search"
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id);
        }}
      />
    </>
  );
}
