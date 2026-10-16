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
import { formatCurrency, formatDate } from '@/lib/format';
import { useDeletePerson, usePeople } from './api';
import { PersonFormDialog } from './person-form-dialog';
import type { PersonRow } from './schema';

export function PeoplePage() {
  const people = usePeople();
  const remove = useDeletePerson();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<{ open: boolean; person?: PersonRow }>({ open: false });
  const [toDelete, setToDelete] = useState<PersonRow | null>(null);

  const filtered = useMemo(() => filterBy(people.data ?? [], search, ['name', 'email', 'phone']), [people.data, search]);
  const paging = usePagedRows(filtered);

  return (
    <>
      <PageHeader title="People">
        <Button onClick={() => setForm({ open: true })}>Add person</Button>
      </PageHeader>

      <div className="mb-6">
        <SearchField
          id="person-search"
          label="Search people"
          value={search}
          onChange={(value) => {
            setSearch(value);
            paging.setPage(0);
          }}
        />
      </div>

      <Panel>
        <QueryBoundary
          isLoading={people.isLoading}
          isError={people.isError}
          onRetry={() => void people.refetch()}
          isEmpty={!people.data?.length}
          empty={
            <div className="grid justify-items-start gap-1">
              <p className="text-body">No people yet.</p>
              <Button variant="quiet" onClick={() => setForm({ open: true })}>
                Add the first person
              </Button>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <p className="p-6 text-body">No people match “{search.trim()}”.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Left</TableHead>
                    <TableHead className="text-right">Monthly salary</TableHead>
                    <TableHead>Contract</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paging.pageRows.map((person) => (
                    <TableRow key={person.id}>
                      <TableCell className="font-semibold">{person.name}</TableCell>
                      <TableCell className="min-w-[12rem]">
                        {person.email ? <span className="block">{person.email}</span> : null}
                        {person.phone ? <span className="block text-small">{person.phone}</span> : null}
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap">{formatDate(person.joinDate)}</TableCell>
                      <TableCell className="tabular whitespace-nowrap">{formatDate(person.leaveDate)}</TableCell>
                      <TableCell className="tabular whitespace-nowrap text-right">
                        {person.monthlySalary === null ? '' : formatCurrency(person.monthlySalary)}
                      </TableCell>
                      <TableCell>
                        {person.contractLink ? (
                          <a
                            href={person.contractLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Contract for ${person.name}`}
                            className="font-semibold text-foreground underline"
                          >
                            Contract
                          </a>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <IconButton
                          label={`Edit ${person.name}`}
                          icon={LuPencil}
                          onClick={() => setForm({ open: true, person })}
                        />
                        <IconButton label={`Delete ${person.name}`} icon={LuTrash2} onClick={() => setToDelete(person)} />
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

      <PersonFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        person={form.person}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={`Delete person “${toDelete?.name ?? ''}”?`}
        description="Project resources that name this person keep their own name and rate but lose the link to them. This cannot be undone."
        confirmLabel="Delete person"
        fallbackFocusId="person-search"
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id);
        }}
      />
    </>
  );
}
