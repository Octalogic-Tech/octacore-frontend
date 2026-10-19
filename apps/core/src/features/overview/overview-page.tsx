import { useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { LinkArrow } from '@/components/ui/link-arrow';
import { useAllInvoices, useProjects } from '@/features/projects/api';
import { formatDate, pluralize } from '@/lib/format';
import { formatUsd } from '@/lib/money';
import { summarize } from './summary';

export function OverviewPage() {
  const projects = useProjects();
  const invoices = useAllInvoices();
  const summary = useMemo(() => summarize(projects.data ?? [], invoices.data ?? []), [projects.data, invoices.data]);

  return (
    <>
      <PageHeader title="Overview" />
      <QueryBoundary
        isLoading={projects.isLoading || invoices.isLoading}
        isError={projects.isError || invoices.isError}
        onRetry={() => {
          void projects.refetch();
          void invoices.refetch();
        }}
        isEmpty={false}
        empty={null}
      >
        <div className="border-t border-navy">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-rule py-5">
            <p className="max-w-[64ch] text-statement">
              <span className="tabular font-semibold">{formatUsd(summary.totalOutstanding)}</span> outstanding
              across {pluralize(summary.projectCount, 'project')}, of{' '}
              <span className="tabular font-semibold">{formatUsd(summary.totalValue)}</span> in total.
            </p>
            <LinkArrow to="/projects">All projects</LinkArrow>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-rule py-5">
            <p className="max-w-[64ch] text-statement">
              {summary.unpaidCount === 0
                ? 'No invoices are unpaid.'
                : `${pluralize(summary.unpaidCount, 'invoice')} ${summary.unpaidCount === 1 ? 'is' : 'are'} unpaid.`}
            </p>
            <LinkArrow to="/finance/invoices">Review invoices</LinkArrow>
          </div>
        </div>

        <div className="mt-12 grid gap-x-12 gap-y-10 lg:grid-cols-2">
          <section aria-labelledby="largest-outstanding">
            <h2 id="largest-outstanding" className="text-title font-semibold">
              Largest outstanding
            </h2>
            {summary.topOutstanding.length === 0 ? (
              <p className="mt-3 border-t border-navy pt-3 text-body text-navy-80">Nothing is outstanding.</p>
            ) : (
              <ul className="mt-3 border-t border-navy">
                {summary.topOutstanding.map((project) => (
                  <li key={project.id} className="flex items-baseline justify-between gap-4 border-b border-rule py-3">
                    <span>
                      <span className="block font-semibold">{project.name}</span>
                      <span className="block text-small text-navy-80">{project.clientName}</span>
                    </span>
                    <span className="tabular">{formatUsd(project.totalOutstandingCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="unpaid-invoices">
            <h2 id="unpaid-invoices" className="text-title font-semibold">
              Unpaid invoices
            </h2>
            {summary.unpaidInvoices.length === 0 ? (
              <p className="mt-3 border-t border-navy pt-3 text-body text-navy-80">Nothing is unpaid.</p>
            ) : (
              <ul className="mt-3 border-t border-navy">
                {summary.unpaidInvoices.map((invoice) => (
                  <li key={invoice.id} className="flex items-baseline justify-between gap-4 border-b border-rule py-3">
                    <span>
                      <span className="block font-semibold">{invoice.number}</span>
                      <span className="block text-small text-navy-80">
                        {[invoice.projectName, invoice.dueDate ? `due ${formatDate(invoice.dueDate)}` : 'no due date']
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </span>
                    <span className="tabular">{formatUsd(invoice.amountCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </QueryBoundary>
    </>
  );
}
