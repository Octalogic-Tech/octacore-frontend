import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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

const NONE = '—';

export function ProjectsPage() {
  const projects = useProjects();
  const [search, setSearch] = useState('');

  const rows = useMemo(() => projects.data ?? [], [projects.data]);
  const filtered = useMemo(
    () => filterBy(rows, search, ['name', 'description', 'clientName', 'projectTypeLabel', 'billingTypeLabel']),
    [rows, search],
  );
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
          isLoading={projects.isLoading}
          isError={projects.isError}
          onRetry={() => void projects.refetch()}
          isEmpty={!projects.data?.length}
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
                    <TableHead>Type</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead className="text-right">Total value</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paging.pageRows.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-semibold">
                        <Link
                          to={`/projects/${project.id}`}
                          className="inline-flex min-h-11 items-center decoration-teal decoration-2 underline-offset-[0.25em] hover:underline focus-visible:underline"
                        >
                          {project.name}
                        </Link>
                      </TableCell>
                      <TableCell>{project.clientName}</TableCell>
                      <TableCell>{project.projectTypeLabel || NONE}</TableCell>
                      <TableCell>{project.billingTypeLabel || NONE}</TableCell>
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
