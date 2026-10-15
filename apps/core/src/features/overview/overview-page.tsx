import { useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { LinkArrow } from '@/components/ui/link-arrow';
import { useBills } from '@/features/bills/api';
import { useProjects } from '@/features/projects/api';
import { formatCurrency, formatDate, pluralize } from '@/lib/format';
import { summarize } from './summary';

export function OverviewPage() {
  const projects = useProjects();
  const bills = useBills();
  const summary = useMemo(() => summarize(projects.data ?? [], bills.data ?? []), [projects.data, bills.data]);

  return (
    <>
      <PageHeader title="Overview" />
      <QueryBoundary
        isLoading={projects.isLoading || bills.isLoading}
        isError={projects.isError || bills.isError}
        onRetry={() => {
          void projects.refetch();
          void bills.refetch();
        }}
        isEmpty={false}
        empty={null}
      >
        <div className="border-t border-navy">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-rule py-5">
            <p className="max-w-[64ch] text-statement">
              <span className="tabular font-semibold">{formatCurrency(summary.totalOutstanding)}</span> outstanding
              across {pluralize(summary.projectCount, 'project')}, of{' '}
              <span className="tabular font-semibold">{formatCurrency(summary.totalValue)}</span> in total.
            </p>
            <LinkArrow to="/projects">All projects</LinkArrow>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-rule py-5">
            <p className="max-w-[64ch] text-statement">
              {summary.pendingCount === 0
                ? 'No bills are waiting for approval.'
                : `${pluralize(summary.pendingCount, 'bill')} ${summary.pendingCount === 1 ? 'is' : 'are'} waiting for approval.`}
            </p>
            <LinkArrow to="/finance/receipts-bills">Review bills</LinkArrow>
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
                    <span className="tabular">{formatCurrency(project.totalOutstanding)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="awaiting-approval">
            <h2 id="awaiting-approval" className="text-title font-semibold">
              Awaiting approval
            </h2>
            {summary.pendingBills.length === 0 ? (
              <p className="mt-3 border-t border-navy pt-3 text-body text-navy-80">Nothing is waiting.</p>
            ) : (
              <ul className="mt-3 border-t border-navy">
                {summary.pendingBills.map((bill) => (
                  <li key={bill.id} className="flex items-baseline justify-between gap-4 border-b border-rule py-3">
                    <span>
                      <span className="tabular block font-semibold">{formatDate(bill.billDate)}</span>
                      <span className="block text-small text-navy-80">
                        {bill.billType}, {bill.uploadedBy}
                      </span>
                    </span>
                    <span className="tabular">{formatCurrency(bill.amount)}</span>
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
