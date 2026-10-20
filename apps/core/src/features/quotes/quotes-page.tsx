import { useMemo, useState } from 'react';
import { LuPencil, LuTrash2 } from 'react-icons/lu';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { SearchField } from '@/components/search-field';
import { TablePager } from '@/components/table-pager';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { IconButton } from '@/components/ui/icon-button';
import { Panel } from '@/components/ui/panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney } from '@/features/expenses/money';
import { usePagedRows } from '@/hooks/use-paged-rows';
import { filterBy } from '@/lib/filter';
import { formatDate } from '@/lib/format';
import { useDeleteQuote, useQuotes } from './api';
import { formatHours } from './calc';
import type { QuoteRow } from './schema';

const lineCountOf = (quote: QuoteRow) => quote.sections.reduce((sum, section) => sum + section.lines.length, 0);

const NEW_QUOTE = '/quotes/new';

/** `/quotes`: every quotation, found by title, opened in the editor. */
export function QuotesPage() {
  const navigate = useNavigate();
  const quotes = useQuotes();
  const remove = useDeleteQuote();
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<QuoteRow | null>(null);

  const rows = useMemo(() => quotes.data ?? [], [quotes.data]);
  const filtered = useMemo(() => filterBy(rows, search, ['title']), [rows, search]);
  const paging = usePagedRows(filtered);

  return (
    <>
      <PageHeader title="Quotes">
        <Button onClick={() => navigate(NEW_QUOTE)}>New quote</Button>
      </PageHeader>

      <div className="mb-6">
        <SearchField
          id="quote-search"
          label="Search quotes"
          value={search}
          onChange={(value) => {
            setSearch(value);
            paging.setPage(0);
          }}
        />
      </div>

      <Panel>
        <QueryBoundary
          isLoading={quotes.isLoading}
          isError={quotes.isError}
          onRetry={() => void quotes.refetch()}
          isEmpty={!quotes.data?.length}
          empty={
            <div className="grid justify-items-start gap-1">
              <p className="text-body">No quotes yet.</p>
              <Button variant="quiet" onClick={() => navigate(NEW_QUOTE)}>
                Create the first quote
              </Button>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <p className="p-6 text-body">No quotes match “{search.trim()}”.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead className="text-right">Lines</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Final quote</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paging.pageRows.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-semibold">
                        <Link
                          to={`/quotes/${quote.id}`}
                          className="inline-flex min-h-11 items-center decoration-teal decoration-2 underline-offset-[0.25em] hover:underline focus-visible:underline"
                        >
                          {quote.title}
                        </Link>
                      </TableCell>
                      {/* The lines of every section. */}
                      <TableCell className="tabular text-right">{lineCountOf(quote)}</TableCell>
                      {/* The service answers hours as decimal numbers (1485, 36.34); the mirror's formatter wants hundredths. */}
                      <TableCell className="tabular text-right">
                        {formatHours(Math.round(quote.totals.totalHours * 100))}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatMoney(quote.totals.finalQuoteCents, {
                          currencyCode: quote.currencyCode,
                          currencySymbol: quote.currencyCode,
                        })}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(quote.updatedDate)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <IconButton
                          label={`Edit ${quote.title}`}
                          icon={LuPencil}
                          onClick={() => navigate(`/quotes/${quote.id}`)}
                        />
                        <IconButton label={`Delete ${quote.title}`} icon={LuTrash2} onClick={() => setToDelete(quote)} />
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

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={`Delete quote “${toDelete?.title ?? ''}”?`}
        description="Its lines and settings are deleted with it. This cannot be undone."
        confirmLabel="Delete quote"
        fallbackFocusId="quote-search"
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id);
        }}
      />
    </>
  );
}
