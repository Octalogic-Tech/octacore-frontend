import type { ReactNode } from 'react';
import { useClientDetails, type ListState } from '@/features/clients/api';
import { formatDate, localToday } from '@/lib/format';
import { formatUsd } from '@/lib/money';
import { overdueTotal, type InvoiceRow, type ProjectRow } from './schema';

const NONE = '—';
const UNAVAILABLE = 'Unavailable';

const mailLink =
  'inline-flex min-h-11 items-center decoration-teal decoration-2 underline-offset-[0.25em] hover:underline focus-visible:underline';

/** What a fact reads while its list loads (empty), after it failed (Unavailable) and once it is known (the value or a dash). */
function known(state: ListState, value: ReactNode): ReactNode {
  if (state === 'loading') return null;
  if (state === 'failed') return UNAVAILABLE;
  return value || NONE;
}

interface ProjectOverviewProps {
  project: ProjectRow;
  /** Undefined until the project's invoices have loaded, or when they could not be; the sentence then leaves overdue out. */
  invoices: readonly InvoiceRow[] | undefined;
}

/** What is owed, said first, then who the project is for and how it is billed. */
export function ProjectOverview({ project, invoices }: ProjectOverviewProps) {
  const overdue = invoices ? overdueTotal(invoices, localToday()) : 0;
  // A client the service no longer embeds comes back as null while `clientId` is still set: nothing is shown for it.
  const hasClient = project.clientId !== null && project.clientName !== '';
  const details = useClientDetails(hasClient ? project.clientId : null);
  const location = [details.client?.city, details.client?.countryName].filter(Boolean).join(', ');
  const clientFact = (state: ListState, value: ReactNode) => (hasClient ? known(state, value) : NONE);

  return (
    <>
      <p className="mb-8 max-w-[64ch] text-statement">
        {invoices?.length === 0 ? (
          'Nothing is invoiced yet.'
        ) : (
          <>
            <span className="tabular font-semibold">{formatUsd(project.totalOutstandingCents)}</span> outstanding
            of <span className="tabular font-semibold">{formatUsd(project.totalValueCents)}</span> invoiced
            {overdue > 0 ? (
              <>
                , <span className="tabular font-semibold">{formatUsd(overdue)}</span> of it overdue
              </>
            ) : null}
            .
          </>
        )}
      </p>

      <dl className="mb-6 grid gap-x-12 gap-y-4 sm:grid-cols-3">
        <div>
          <dt className="text-small text-navy-80">Client</dt>
          <dd className="font-semibold">{project.clientName || NONE}</dd>
        </div>
        <div>
          <dt className="text-small text-navy-80">Location</dt>
          <dd className="font-semibold">{clientFact(details.clientsState, location)}</dd>
        </div>
        <div>
          <dt className="text-small text-navy-80">Contact</dt>
          <dd className="font-semibold">{clientFact(details.contactsState, details.contact?.name)}</dd>
        </div>
        <div>
          <dt className="text-small text-navy-80">Email</dt>
          <dd className="font-semibold">
            {clientFact(
              details.contactsState,
              details.contact?.email ? (
                <a href={`mailto:${details.contact.email}`} className={mailLink}>
                  {details.contact.email}
                </a>
              ) : null,
            )}
          </dd>
        </div>
        <div>
          <dt className="text-small text-navy-80">Phone</dt>
          <dd className="font-semibold">{clientFact(details.contactsState, details.contact?.phone)}</dd>
        </div>
        <div>
          <dt className="text-small text-navy-80">Project type</dt>
          <dd className="font-semibold">{project.projectTypeLabel || NONE}</dd>
        </div>
        <div>
          <dt className="text-small text-navy-80">Billing type</dt>
          <dd className="font-semibold">{project.billingTypeLabel || NONE}</dd>
        </div>
        <div>
          <dt className="text-small text-navy-80">Key</dt>
          <dd className="font-semibold">{project.key || NONE}</dd>
        </div>
        <div>
          <dt className="text-small text-navy-80">Discount</dt>
          <dd className="font-semibold">{project.discountPercent > 0 ? `${project.discountPercent}%` : NONE}</dd>
        </div>
        <div>
          <dt className="text-small text-navy-80">Start</dt>
          <dd className="font-semibold">{project.startDate ? formatDate(project.startDate) : NONE}</dd>
        </div>
        <div>
          <dt className="text-small text-navy-80">End</dt>
          <dd className="font-semibold">{project.endDate ? formatDate(project.endDate) : NONE}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-small text-navy-80">Billing address</dt>
          <dd className="whitespace-pre-line font-semibold">{project.billingAddress || NONE}</dd>
        </div>
        <div className="sm:col-span-3">
          <dt className="text-small text-navy-80">Technologies</dt>
          <dd className="font-semibold">{project.technologies.map((technology) => technology.name).join(', ') || NONE}</dd>
        </div>
      </dl>
      {project.description ? <p className="max-w-[64ch] text-body">{project.description}</p> : null}
    </>
  );
}
