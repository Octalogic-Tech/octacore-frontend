import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LinkArrow } from '@/components/ui/link-arrow';
import { Panel } from '@/components/ui/panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { statusOf } from '@/lib/core-api';
import { formatCurrency, formatDate, localToday } from '@/lib/format';
import {
  useDeleteInvoice,
  useDeleteProject,
  useInvoices,
  useProject,
  useSetInvoicePaid,
} from './api';
import { InvoiceFormDialog } from './invoice-form-dialog';
import { ProjectFormDialog } from './project-form-dialog';
import { sortInvoices, type InvoiceRow } from './schema';

// The focus fallback for every dialog on this page: <main> is not focusable, and Add invoice is always there.
const NONE = '—';
const INT32_MAX = 2_147_483_647;

const backLink =
  'mb-4 inline-flex min-h-11 items-center font-semibold decoration-teal decoration-2 underline-offset-[0.25em] hover:underline focus-visible:underline';

function ProjectNotFound() {
  return (
    <>
      <PageHeader title="Project not found" />
      <Panel>
        <div className="grid justify-items-start gap-2 p-6">
          <p className="text-body">This project does not exist, or it was deleted.</p>
          <LinkArrow to="/projects">Back to projects</LinkArrow>
        </div>
      </Panel>
    </>
  );
}

export function ProjectDetailPage() {
  const { id = '' } = useParams();
  // Only a plain positive integer the service could hold is worth asking about; anything else is not a project.
  const projectId = /^[1-9]\d{0,9}$/.test(id) ? Number(id) : 0;
  if (projectId < 1 || projectId > INT32_MAX) return <ProjectNotFound />;
  return <ProjectDetail projectId={projectId} />;
}

function ProjectDetail({ projectId }: { projectId: number }) {
  const navigate = useNavigate();
  const project = useProject(projectId);
  const invoices = useInvoices(projectId);
  const removeProject = useDeleteProject();
  const removeInvoice = useDeleteInvoice();
  const setPaid = useSetInvoicePaid();
  const [projectForm, setProjectForm] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState<{ open: boolean; invoice?: InvoiceRow }>({ open: false });
  const [deletingProject, setDeletingProject] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<InvoiceRow | null>(null);
  const [paidFailed, setPaidFailed] = useState(false);

  const rows = useMemo(() => sortInvoices(invoices.data ?? []), [invoices.data]);

  if (statusOf(project.error) === 404) return <ProjectNotFound />;

  const data = project.data;

  async function togglePaid(invoice: InvoiceRow) {
    setPaidFailed(false);
    try {
      await setPaid.mutateAsync({ id: invoice.id, paidDate: invoice.paidDate ? null : localToday() });
    } catch {
      setPaidFailed(true);
    }
  }

  return (
    <>
      <Link to="/projects" className={backLink}>
        Back to projects
      </Link>
      <PageHeader title={data?.name ?? 'Project'}>
        {data ? (
          <>
            <Button variant="quiet" onClick={() => setProjectForm(true)}>
              Edit project
            </Button>
            <Button variant="quiet" onClick={() => setDeletingProject(true)}>
              Delete project
            </Button>
            <Button id="add-invoice" onClick={() => setInvoiceForm({ open: true })}>
              Add invoice
            </Button>
          </>
        ) : null}
      </PageHeader>

      <QueryBoundary
        isLoading={project.isLoading}
        isError={project.isError}
        onRetry={() => {
          void project.refetch();
          void invoices.refetch();
        }}
        isEmpty={false}
        empty={null}
      >
        {data ? (
          <>
            <dl className="mb-6 grid gap-x-12 gap-y-4 border-t border-navy pt-4 sm:grid-cols-3">
              <div>
                <dt className="text-small text-navy-80">Client</dt>
                <dd className="font-semibold">{data.clientName || NONE}</dd>
              </div>
              <div>
                <dt className="text-small text-navy-80">Project type</dt>
                <dd className="font-semibold">{data.projectTypeLabel || NONE}</dd>
              </div>
              <div>
                <dt className="text-small text-navy-80">Billing type</dt>
                <dd className="font-semibold">{data.billingTypeLabel || NONE}</dd>
              </div>
            </dl>
            {data.description ? <p className="mb-6 max-w-[64ch] text-body">{data.description}</p> : null}

            <p className="mb-8 max-w-[64ch] text-statement">
              {invoices.data?.length === 0 ? (
                'Nothing is invoiced yet.'
              ) : (
                <>
                  <span className="tabular font-semibold">{formatCurrency(data.totalOutstanding)}</span> outstanding of{' '}
                  <span className="tabular font-semibold">{formatCurrency(data.totalValue)}</span> invoiced.
                </>
              )}
            </p>

            {paidFailed ? (
              <p role="alert" className="mb-4 text-small font-semibold text-foreground">
                That did not save. Try again.
              </p>
            ) : null}

            <Panel>
              <QueryBoundary
                isLoading={invoices.isLoading}
                isError={invoices.isError}
                onRetry={() => void invoices.refetch()}
                isEmpty={!invoices.data?.length}
                empty={
                  <div className="grid justify-items-start gap-1">
                    <p className="text-body">No invoices yet.</p>
                    <Button variant="quiet" onClick={() => setInvoiceForm({ open: true })}>
                      Add the first invoice
                    </Button>
                  </div>
                }
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Number</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="min-w-[10rem]">
                          <span className="block font-semibold">{invoice.number}</span>
                          {invoice.description ? <span className="block text-small">{invoice.description}</span> : null}
                        </TableCell>
                        <TableCell className="tabular whitespace-nowrap">{formatDate(invoice.issueDate)}</TableCell>
                        <TableCell className="tabular whitespace-nowrap">
                          {invoice.dueDate ? formatDate(invoice.dueDate) : NONE}
                        </TableCell>
                        <TableCell className="tabular text-right">{formatCurrency(invoice.amount)}</TableCell>
                        <TableCell>
                          {invoice.paidDate ? (
                            <Badge variant="outline">Paid {formatDate(invoice.paidDate)}</Badge>
                          ) : (
                            <Badge>Unpaid</Badge>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <Button
                            variant="quiet"
                            aria-label={`${invoice.paidDate ? 'Mark unpaid' : 'Mark paid'} ${invoice.number}`}
                            disabled={setPaid.isPending}
                            onClick={() => void togglePaid(invoice)}
                          >
                            {invoice.paidDate ? 'Mark unpaid' : 'Mark paid'}
                          </Button>
                          <Button
                            variant="quiet"
                            aria-label={`Edit ${invoice.number}`}
                            onClick={() => setInvoiceForm({ open: true, invoice })}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="quiet"
                            aria-label={`Delete ${invoice.number}`}
                            onClick={() => setInvoiceToDelete(invoice)}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </QueryBoundary>
            </Panel>
          </>
        ) : null}
      </QueryBoundary>

      <ProjectFormDialog open={projectForm} onOpenChange={setProjectForm} project={data} fallbackFocusId="add-invoice" />

      <InvoiceFormDialog
        open={invoiceForm.open}
        onOpenChange={(open) => setInvoiceForm((current) => ({ ...current, open }))}
        projectId={projectId}
        invoice={invoiceForm.invoice}
        fallbackFocusId="add-invoice"
      />

      <ConfirmDialog
        open={deletingProject}
        onOpenChange={setDeletingProject}
        title={`Delete project “${data?.name ?? ''}”?`}
        description="Its invoices are deleted with it. This cannot be undone."
        confirmLabel="Delete project"
        fallbackFocusId="add-invoice"
        onConfirm={async () => {
          await removeProject.mutateAsync(projectId);
          navigate('/projects');
        }}
      />

      <ConfirmDialog
        open={invoiceToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setInvoiceToDelete(null);
        }}
        title={`Delete invoice “${invoiceToDelete?.number ?? ''}”?`}
        description="This cannot be undone."
        confirmLabel="Delete invoice"
        fallbackFocusId="add-invoice"
        onConfirm={async () => {
          if (invoiceToDelete) await removeInvoice.mutateAsync(invoiceToDelete.id);
        }}
      />
    </>
  );
}
