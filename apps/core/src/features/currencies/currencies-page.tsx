import { useMemo, useState } from 'react';
import { LuPencil, LuTrash2 } from 'react-icons/lu';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { SearchField } from '@/components/search-field';
import { TablePager } from '@/components/table-pager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { IconButton } from '@/components/ui/icon-button';
import { Panel } from '@/components/ui/panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatRate } from '@/features/expenses/money';
import { usePagedRows } from '@/hooks/use-paged-rows';
import { filterBy } from '@/lib/filter';
import { formatDate } from '@/lib/format';
import { useCurrencies, useDeleteCurrency } from './api';
import { CurrencyFormDialog } from './currency-form-dialog';
import { PRIMARY_CURRENCY, type CurrencyRow } from './schema';

export function CurrenciesPage() {
  const { data, isLoading, isError, refetch } = useCurrencies();
  const remove = useDeleteCurrency();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<{ open: boolean; currency?: CurrencyRow }>({ open: false });
  const [toDelete, setToDelete] = useState<CurrencyRow | null>(null);

  const filtered = useMemo(() => filterBy(data ?? [], search, ['code', 'name', 'symbol']), [data, search]);
  const paging = usePagedRows(filtered);

  return (
    <>
      <PageHeader title="Currencies">
        <Button onClick={() => setForm({ open: true })}>Add currency</Button>
      </PageHeader>

      <p className="mb-6 max-w-[64ch] text-body text-navy-80">
        Rates are typed by hand: how many of a currency make one US dollar. An expense typed in another currency is
        converted at the rate here when it is saved, and keeps that rate.
      </p>

      <div className="mb-6">
        <SearchField
          id="currency-search"
          label="Search currencies"
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
              <p className="text-body">No currencies yet.</p>
              <Button variant="quiet" onClick={() => setForm({ open: true })}>
                Add the first currency
              </Button>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <p className="p-6 text-body">No currencies match “{search.trim()}”.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead className="text-right">Per US dollar</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paging.pageRows.map((currency) => (
                    <TableRow key={currency.id}>
                      <TableCell className="font-semibold">{currency.code}</TableCell>
                      <TableCell>{currency.name}</TableCell>
                      <TableCell>{currency.symbol}</TableCell>
                      <TableCell className="tabular text-right">{formatRate(currency.rate)}</TableCell>
                      <TableCell className="tabular">{formatDate(currency.updatedDate)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {currency.code === PRIMARY_CURRENCY ? (
                          <Badge variant="outline">Primary</Badge>
                        ) : (
                          <>
                            <IconButton
                              label={`Edit ${currency.name}`}
                              icon={LuPencil}
                              onClick={() => setForm({ open: true, currency })}
                            />
                            <IconButton
                              label={`Delete ${currency.name}`}
                              icon={LuTrash2}
                              onClick={() => setToDelete(currency)}
                            />
                          </>
                        )}
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

      <CurrencyFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        currency={form.currency}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={`Delete currency “${toDelete?.name ?? ''}”?`}
        description="This cannot be undone. A currency that an expense uses cannot be deleted."
        confirmLabel="Delete currency"
        fallbackFocusId="currency-search"
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id);
        }}
      />
    </>
  );
}
