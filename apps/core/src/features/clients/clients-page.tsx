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
import { useClientContacts, useClients, useDeleteClient } from './api';
import { ClientFormDialog } from './client-form-dialog';
import { joinContacts, type ClientListRow } from './schema';

export function ClientsPage() {
  const clients = useClients();
  const contacts = useClientContacts();
  const remove = useDeleteClient();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<{ open: boolean; client?: ClientListRow }>({ open: false });
  const [toDelete, setToDelete] = useState<ClientListRow | null>(null);

  const rows = useMemo(() => joinContacts(clients.data ?? [], contacts.data ?? []), [clients.data, contacts.data]);
  const filtered = useMemo(
    () => filterBy(rows, search, ['name', 'description', 'city', 'countryName', 'contactName', 'contactEmail']),
    [rows, search],
  );
  const paging = usePagedRows(filtered);

  return (
    <>
      <PageHeader title="Clients">
        <Button onClick={() => setForm({ open: true })}>Add client</Button>
      </PageHeader>

      <div className="mb-6">
        <SearchField
          id="client-search"
          label="Search clients"
          value={search}
          onChange={(value) => {
            setSearch(value);
            paging.setPage(0);
          }}
        />
      </div>

      <Panel>
        <QueryBoundary
          isLoading={clients.isLoading || contacts.isLoading}
          isError={clients.isError || contacts.isError}
          onRetry={() => {
            void clients.refetch();
            void contacts.refetch();
          }}
          isEmpty={!clients.data?.length}
          empty={
            <div className="grid justify-items-start gap-1">
              <p className="text-body">No clients yet.</p>
              <Button variant="quiet" onClick={() => setForm({ open: true })}>
                Add the first client
              </Button>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <p className="p-6 text-body">No clients match “{search.trim()}”.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paging.pageRows.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-semibold">{client.name}</TableCell>
                      <TableCell className="min-w-[14rem]">{client.description}</TableCell>
                      <TableCell className="min-w-[12rem]">
                        {client.contact ? (
                          <>
                            <span className="block font-semibold">{client.contact.name}</span>
                            {client.contact.email ? <span className="block text-small">{client.contact.email}</span> : null}
                            {client.contact.phone ? <span className="block text-small">{client.contact.phone}</span> : null}
                          </>
                        ) : null}
                      </TableCell>
                      <TableCell>{client.countryName}</TableCell>
                      <TableCell>{client.city}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Button
                          variant="quiet"
                          aria-label={`Edit ${client.name}`}
                          onClick={() => setForm({ open: true, client })}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="quiet"
                          aria-label={`Delete ${client.name}`}
                          onClick={() => setToDelete(client)}
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

      <ClientFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        client={form.client}
        contact={form.client?.contact}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={`Delete client “${toDelete?.name ?? ''}”?`}
        description="This cannot be undone."
        confirmLabel="Delete client"
        fallbackFocusId="client-search"
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id);
        }}
      />
    </>
  );
}
