import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { SearchField } from '@/components/search-field';
import { TablePager } from '@/components/table-pager';
import { Panel } from '@/components/ui/panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePagedRows } from '@/hooks/use-paged-rows';
import { filterBy } from '@/lib/filter';
import { formatCurrency } from '@/lib/format';
import { useProjects } from './api';

export function ProjectsPage() {
  const { data, isLoading, isError, refetch } = useProjects();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => filterBy(data ?? [], search, ['name', 'client', 'description']), [data, search]);
  const paging = usePagedRows(filtered);

  return (
    <>
      <PageHeader title="Projects" />

      <div className="mb-6">
        <SearchField
          id="project-search"
          label="Search projects"
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
          empty={<p className="text-body">No projects yet.</p>}
        >
          {filtered.length === 0 ? (
            <p className="p-6 text-body">No projects match “{search.trim()}”.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Total value</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paging.pageRows.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-semibold">{project.name}</TableCell>
                      <TableCell>{project.client}</TableCell>
                      <TableCell className="tabular text-right">{formatCurrency(project.totalValue)}</TableCell>
                      <TableCell className="tabular text-right">{formatCurrency(project.totalOutstanding)}</TableCell>
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
