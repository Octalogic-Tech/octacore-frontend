import { useMemo, useState } from 'react';
import { LuPencil, LuTrash2 } from 'react-icons/lu';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { SearchField } from '@/components/search-field';
import { TablePager } from '@/components/table-pager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { Panel } from '@/components/ui/panel';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePagedRows } from '@/hooks/use-paged-rows';
import { statusOf } from '@/lib/core-api';
import { filterBy } from '@/lib/filter';
import { pluralize } from '@/lib/format';
import { useCountries, useSyncRates } from './api';
import { CountryFormDialog } from './country-form-dialog';
import { DeleteCountryDialog } from './delete-country-dialog';
import { formatCountryRate, formatTaxRate } from './format';
import type { Country, SyncResult } from './schema';

type Show = 'all' | 'active';

/** What to tell the person once a sync has answered: how many rates changed, and which currencies had none. */
function syncMessages(result: SyncResult): string[] {
  const messages = [`Updated ${pluralize(result.updatedCountries, 'rate')} as of ${result.date}.`];
  if (result.missingCurrencies.length > 0) {
    messages.push(`No rate found for ${result.missingCurrencies.join(', ')}.`);
  }
  return messages;
}

export function CountriesPage() {
  const { data, isLoading, isError, refetch } = useCountries();
  const sync = useSyncRates();
  const [search, setSearch] = useState('');
  const [show, setShow] = useState<Show>('all');
  const [form, setForm] = useState<{ open: boolean; country?: Country }>({ open: false });
  const [toDelete, setToDelete] = useState<Country | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncProblem, setSyncProblem] = useState<string | null>(null);

  // A calling code is written with its plus (+44), so a search can start with one.
  const query = search.replace(/^\s*\+/, '');
  const filtered = useMemo(() => {
    const shown = (data ?? []).filter((country) => show === 'all' || country.active);
    // The service lists by id, which puts a country added here after all the seeded ones.
    return filterBy(shown, query, ['nicename', 'iso', 'iso3', 'phonecode', 'currencyCode', 'currencyName']).sort(
      (a, b) => a.nicename.localeCompare(b.nicename),
    );
  }, [data, query, show]);
  const paging = usePagedRows(filtered);

  async function syncRates() {
    setSyncResult(null);
    setSyncProblem(null);
    try {
      setSyncResult(await sync.mutateAsync());
    } catch (error) {
      setSyncProblem(
        statusOf(error) === 502 ? 'Could not reach the exchange rate service.' : 'The rates could not be synced.',
      );
    }
  }

  return (
    <>
      <PageHeader title="Countries">
        <Button variant="quiet" disabled={sync.isPending} onClick={() => void syncRates()}>
          {sync.isPending ? 'Syncing…' : 'Sync rates'}
        </Button>
        <Button onClick={() => setForm({ open: true })}>Add country</Button>
      </PageHeader>

      <p className="mb-6 max-w-[64ch] text-body text-navy-80">
        A country carries its currency, the rate (how many of that currency make one US dollar) and a tax rate. The
        active countries are the ones offered when you pick a country. Sync rates fetches today’s rates for them, and
        runs only when you press it.
      </p>

      {syncResult ? (
        <div role="status" className="mb-4 grid gap-1 text-small font-semibold text-foreground">
          {syncMessages(syncResult).map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : null}
      {syncProblem ? (
        <div role="alert" className="mb-4 flex flex-wrap items-center gap-x-3 text-small font-semibold text-foreground">
          <p>{syncProblem}</p>
          <Button variant="quiet" disabled={sync.isPending} onClick={() => void syncRates()}>
            Try again
          </Button>
        </div>
      ) : null}

      <div className="mb-6 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <SearchField
          id="country-search"
          label="Search countries"
          value={search}
          onChange={(value) => {
            setSearch(value);
            paging.setPage(0);
          }}
        />
        <Field label="Show" htmlFor="country-show">
          <Select
            id="country-show"
            value={show}
            onChange={(event) => {
              setShow(event.target.value as Show);
              paging.setPage(0);
            }}
          >
            <option value="all">All countries</option>
            <option value="active">Active countries</option>
          </Select>
        </Field>
      </div>

      <Panel>
        <QueryBoundary
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
          isEmpty={!data?.length}
          empty={
            <div className="grid justify-items-start gap-1">
              <p className="text-body">No countries yet. Running make seed in the core service loads the full list.</p>
              <Button variant="quiet" onClick={() => setForm({ open: true })}>
                Add the first country
              </Button>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <p className="p-6 text-body">
              {search.trim()
                ? `No ${show === 'active' ? 'active ' : ''}countries match “${search.trim()}”.`
                : 'No country is active. Edit one to switch it on.'}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Country</TableHead>
                    <TableHead>ISO</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right">Per US$1</TableHead>
                    <TableHead className="text-right">Tax rate</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paging.pageRows.map((country) => (
                    <TableRow key={country.id}>
                      <TableCell className="font-semibold">{country.nicename}</TableCell>
                      <TableCell>{country.iso}</TableCell>
                      <TableCell>
                        {country.currencyCode} <span className="text-navy-72">{country.currencySymbol}</span>
                      </TableCell>
                      <TableCell className="tabular text-right">{formatCountryRate(country.rate)}</TableCell>
                      <TableCell className="tabular text-right">{formatTaxRate(country.taxRate)}</TableCell>
                      <TableCell>
                        <Badge variant={country.active ? 'solid' : 'outline'}>
                          {country.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <IconButton
                          label={`Edit ${country.nicename}`}
                          icon={LuPencil}
                          onClick={() => setForm({ open: true, country })}
                        />
                        <IconButton
                          label={`Delete ${country.nicename}`}
                          icon={LuTrash2}
                          onClick={() => setToDelete(country)}
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

      <CountryFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        country={form.country}
      />

      <DeleteCountryDialog country={toDelete} onClose={() => setToDelete(null)} />
    </>
  );
}
