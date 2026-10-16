import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { TablePager } from '@/components/table-pager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { LinkArrow } from '@/components/ui/link-arrow';
import { Panel } from '@/components/ui/panel';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePagedRows } from '@/hooks/use-paged-rows';
import { downloadCsv } from '@/lib/csv';
import { formatCurrency, formatDate, localToday } from '@/lib/format';
import { useAllInvoices, useProjects } from '@/features/projects/api';
import { invoicesToCsv } from './csv';
import {
  STATUS_LABELS,
  clientOptions,
  defaultFilters,
  filterInvoices,
  invoiceStatus,
  isDefaultFilters,
  isRangeInverted,
  projectOptions,
  toListRows,
  type InvoiceFilters,
  type InvoiceListRow,
  type StatusFilter,
} from './filters';

const NONE = '—';

const STATUS_CHOICES: { value: StatusFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'all', label: 'All' },
];

/** The words carry the status, as on a project's own page: outlined once paid, filled while money is still owed. */
function StatusBadge({ invoice, today }: { invoice: InvoiceListRow; today: string }) {
  const status = invoiceStatus(invoice, today);
  if (status === 'paid' && invoice.paidDate) return <Badge variant="outline">Paid {formatDate(invoice.paidDate)}</Badge>;
  return <Badge>{STATUS_LABELS[status]}</Badge>;
}

/** A select's value is text: an empty one is "all", anything else is an id. */
const toId = (value: string) => (value === '' ? null : Number(value));

export function InvoicesPage() {
  const invoices = useAllInvoices();
  const projects = useProjects();
  const [filters, setFilters] = useState<InvoiceFilters>(defaultFilters);
  // Read each render, so an invoice turns overdue at midnight without a reload.
  const today = localToday();

  const projectList = useMemo(() => projects.data ?? [], [projects.data]);
  const rows = useMemo(() => toListRows(invoices.data ?? [], projectList), [invoices.data, projectList]);
  const filtered = useMemo(() => filterInvoices(rows, filters, today), [rows, filters, today]);
  const paging = usePagedRows(filtered);
  const clients = useMemo(() => clientOptions(projectList), [projectList]);
  const projectChoices = useMemo(() => projectOptions(projectList, filters.clientId), [projectList, filters.clientId]);
  const inverted = isRangeInverted(filters);

  function update(patch: Partial<InvoiceFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    paging.setPage(0);
  }

  /** A chosen project stays only while it belongs to the new client: otherwise the list would be left empty. */
  function chooseClient(value: string) {
    const clientId = toId(value);
    const keepProject = projectList.some(
      (project) => project.id === filters.projectId && (clientId === null || project.clientId === clientId),
    );
    update({ clientId, projectId: keepProject ? filters.projectId : null });
  }

  return (
    <>
      <PageHeader title="Invoices" />

      <div className="mb-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Status" htmlFor="invoices-status">
          <Select
            id="invoices-status"
            value={filters.status}
            onChange={(event) => update({ status: event.target.value as StatusFilter })}
          >
            {STATUS_CHOICES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Client" htmlFor="invoices-client">
          <Select id="invoices-client" value={filters.clientId ?? ''} onChange={(event) => chooseClient(event.target.value)}>
            <option value="">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Project" htmlFor="invoices-project">
          <Select
            id="invoices-project"
            value={filters.projectId ?? ''}
            onChange={(event) => update({ projectId: toId(event.target.value) })}
          >
            <option value="">All projects</option>
            {projectChoices.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Issued from" htmlFor="invoices-from">
          <Input id="invoices-from" type="date" value={filters.from} onChange={(event) => update({ from: event.target.value })} />
        </Field>
        <Field label="Issued to" htmlFor="invoices-to">
          <Input id="invoices-to" type="date" value={filters.to} onChange={(event) => update({ to: event.target.value })} />
        </Field>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-x-2">
        {isDefaultFilters(filters) ? null : (
          <Button
            variant="quiet"
            onClick={() => {
              setFilters(defaultFilters);
              paging.setPage(0);
            }}
          >
            Clear filters
          </Button>
        )}
        <Button variant="quiet" disabled={filtered.length === 0} onClick={() => downloadCsv('invoices.csv', invoicesToCsv(filtered, today))}>
          Export CSV
        </Button>
      </div>

      {inverted ? (
        <p role="alert" className="mb-4 text-small font-semibold text-foreground">
          The start date is after the end date.
        </p>
      ) : null}

      <Panel>
        <QueryBoundary
          isLoading={invoices.isLoading || projects.isLoading}
          isError={invoices.isError || projects.isError}
          onRetry={() => {
            void invoices.refetch();
            void projects.refetch();
          }}
          isEmpty={!invoices.data?.length}
          empty={
            <div className="grid justify-items-start gap-1">
              <p className="text-body">No invoices yet.</p>
              <LinkArrow to="/projects">Open a project to add one</LinkArrow>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <p className="p-6 text-body">No invoices match these filters.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paging.pageRows.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-semibold">{invoice.number}</TableCell>
                      <TableCell>{invoice.clientName || NONE}</TableCell>
                      <TableCell>
                        {invoice.projectName ? (
                          <Link
                            to={`/projects/${invoice.projectId}`}
                            className="inline-flex min-h-11 items-center decoration-teal decoration-2 underline-offset-[0.25em] hover:underline focus-visible:underline"
                          >
                            {invoice.projectName}
                          </Link>
                        ) : (
                          NONE
                        )}
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap">{formatDate(invoice.issueDate)}</TableCell>
                      <TableCell className="tabular whitespace-nowrap">
                        {invoice.dueDate ? formatDate(invoice.dueDate) : NONE}
                      </TableCell>
                      <TableCell className="tabular text-right">{formatCurrency(invoice.amount)}</TableCell>
                      <TableCell>
                        <StatusBadge invoice={invoice} today={today} />
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
    </>
  );
}
