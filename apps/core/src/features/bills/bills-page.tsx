import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { TablePager } from '@/components/table-pager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePagedRows } from '@/hooks/use-paged-rows';
import { formatCurrency, formatDate } from '@/lib/format';
import { AddBillDialog } from './add-bill-dialog';
import { useBills } from './api';
import { billsToCsv, downloadCsv } from './csv';
import { emptyFilters, filterBills, isRangeInverted } from './filters';
import type { ApprovalFilter, BillFilters } from './types';

export function BillsPage() {
  const { data, isLoading, isError, refetch } = useBills();
  const [filters, setFilters] = useState<BillFilters>(emptyFilters);
  const [adding, setAdding] = useState(false);

  const newestFirst = useMemo(
    () => [...(data ?? [])].sort((a, b) => b.billDate.localeCompare(a.billDate)),
    [data],
  );
  const filtered = useMemo(() => filterBills(newestFirst, filters), [newestFirst, filters]);
  const paging = usePagedRows(filtered);
  const inverted = isRangeInverted(filters);
  const filtersActive = filters.from !== '' || filters.to !== '' || filters.approval !== 'all';

  function update(patch: Partial<BillFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    paging.setPage(0);
  }

  return (
    <>
      <PageHeader title="Receipts and bills">
        <Button onClick={() => setAdding(true)}>Add bill</Button>
      </PageHeader>

      <div className="mb-4 grid gap-x-6 gap-y-4 sm:grid-cols-3">
        <Field label="From" htmlFor="bills-from">
          <Input id="bills-from" type="date" value={filters.from} onChange={(event) => update({ from: event.target.value })} />
        </Field>
        <Field label="To" htmlFor="bills-to">
          <Input id="bills-to" type="date" value={filters.to} onChange={(event) => update({ to: event.target.value })} />
        </Field>
        <Field label="Approval" htmlFor="bills-approval">
          <Select
            id="bills-approval"
            value={filters.approval}
            onChange={(event) => update({ approval: event.target.value as ApprovalFilter })}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
          </Select>
        </Field>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-x-2">
        {filtersActive ? (
          <Button
            variant="quiet"
            onClick={() => {
              setFilters(emptyFilters);
              paging.setPage(0);
            }}
          >
            Clear filters
          </Button>
        ) : null}
        <Button
          variant="quiet"
          disabled={filtered.length === 0}
          onClick={() => downloadCsv('receipts-and-bills.csv', billsToCsv(filtered))}
        >
          Export CSV
        </Button>
      </div>

      {inverted ? (
        <p role="alert" className="mb-4 text-small font-semibold text-foreground">
          From date is after To date.
        </p>
      ) : null}

      <Panel>
        <QueryBoundary
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
          isEmpty={!data?.length}
          empty={
            <div className="grid justify-items-start gap-1">
              <p className="text-body">No bills yet.</p>
              <Button variant="quiet" onClick={() => setAdding(true)}>
                Add the first bill
              </Button>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <p className="p-6 text-body">No bills match these filters.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Bill type</TableHead>
                    <TableHead>Reimbursement</TableHead>
                    <TableHead>Uploaded by</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paging.pageRows.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell className="tabular whitespace-nowrap">{formatDate(bill.billDate)}</TableCell>
                      <TableCell className="tabular text-right">{formatCurrency(bill.amount)}</TableCell>
                      <TableCell>{bill.billType}</TableCell>
                      <TableCell>{bill.actualExpense ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{bill.uploadedBy}</TableCell>
                      <TableCell>
                        <Badge variant={bill.approved ? 'solid' : 'outline'}>
                          {bill.approved ? 'Approved' : 'Pending'}
                        </Badge>
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

      <AddBillDialog open={adding} onOpenChange={setAdding} />
    </>
  );
}
