import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { SearchField } from '@/components/search-field';
import { TablePager } from '@/components/table-pager';
import { Panel } from '@/components/ui/panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePagedRows } from '@/hooks/use-paged-rows';
import { filterBy } from '@/lib/filter';
import { useCountries } from './api';
import { formatIso3, formatNumericCode, formatPhoneCode } from './format';

export function CountriesPage() {
  const { data, isLoading, isError, refetch } = useCountries();
  const [search, setSearch] = useState('');

  // A calling code is shown with its plus, so people type it with one.
  const query = search.replace(/^\s*\+/, '');
  const filtered = useMemo(
    () => filterBy(data ?? [], query, ['nicename', 'iso', 'iso3', 'phonecode']),
    [data, query],
  );
  const paging = usePagedRows(filtered);

  return (
    <>
      <PageHeader title="Countries" />

      <div className="mb-6">
        <SearchField
          id="country-search"
          label="Search countries"
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
          empty={<p className="text-body">No countries yet. The list comes from the core service's seed data.</p>}
        >
          {filtered.length === 0 ? (
            <p className="p-6 text-body">No countries match “{search.trim()}”.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Country</TableHead>
                    <TableHead>ISO</TableHead>
                    <TableHead>ISO3</TableHead>
                    <TableHead className="text-right">Numeric</TableHead>
                    <TableHead className="text-right">Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paging.pageRows.map((country) => (
                    <TableRow key={country.id}>
                      <TableCell className="font-semibold">{country.nicename}</TableCell>
                      <TableCell>{country.iso}</TableCell>
                      <TableCell>{formatIso3(country.iso3)}</TableCell>
                      <TableCell className="tabular text-right">{formatNumericCode(country.numcode)}</TableCell>
                      <TableCell className="tabular text-right">{formatPhoneCode(country.phonecode)}</TableCell>
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
    </>
  );
}
