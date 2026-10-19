import { useMemo, useState } from 'react';
import { LuCircleCheck, LuDownload, LuEye, LuMail, LuPencil, LuTrash2, LuUndo2 } from 'react-icons/lu';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { IconButton } from '@/components/ui/icon-button';
import { LinkArrow } from '@/components/ui/link-arrow';
import { Panel } from '@/components/ui/panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { statusOf } from '@/lib/core-api';
import { formatDate, localToday } from '@/lib/format';
import { formatUsd } from '@/lib/money';
import {
  useDeleteInvoice,
  useDeleteProject,
  useInvoices,
  useProject,
  useProjectResources,
  useSetInvoicePaid,
} from './api';
import { InvoiceEmailDialog } from './invoice-email-dialog';
import { InvoiceFormDialog } from './invoice-form-dialog';
import { downloadInvoicePdf, notSetUpMessage } from './invoice-pdf';
import { InvoicePreviewDialog } from './invoice-preview-dialog';
import { ProjectFormDialog } from './project-form-dialog';
import { ProjectOverview } from './project-overview';
import { ProjectStatusBadge } from './project-status-badge';
import { ResourcesPanel } from './resources-panel';
import { sortInvoices, type InvoiceRow } from './schema';

// The focus fallback for every dialog on this page: <main> is not focusable, and Add invoice is always there.
const NONE = '—';
const INT32_MAX = 2_147_483_647;

// The page's tabs, in order. The chosen one is the `tab` in the address, so a reload, Back or a link lands on it.
const TABS = ['overview', 'invoices', 'resources'] as const;
type Tab = (typeof TABS)[number];
const tabOf = (value: string | null): Tab => TABS.find((tab) => tab === value) ?? 'overview';

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

/** A tab's name with how many it holds, once that is known: "Invoices 4". */
function TabLabel({ label, count }: { label: string; count?: number }) {
  if (count === undefined) return label;
  return (
    <>
      {label} <span className="tabular ml-1.5 font-normal">{count}</span>
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
  // Also read by the Resources tab itself; the same query, so this only adds the count to the tab's name.
  const resources = useProjectResources(projectId);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabOf(searchParams.get('tab'));
  const removeProject = useDeleteProject();
  const removeInvoice = useDeleteInvoice();
  const setPaid = useSetInvoicePaid();
  const [projectForm, setProjectForm] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState<{ open: boolean; invoice?: InvoiceRow }>({ open: false });
  const [deletingProject, setDeletingProject] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<InvoiceRow | null>(null);
  const [paidFailed, setPaidFailed] = useState(false);
  const [previewing, setPreviewing] = useState<InvoiceRow | null>(null);
  const [emailing, setEmailing] = useState<InvoiceRow | null>(null);
  // The page's one line about a document action: a download that failed, or an email that went out.
  const [notice, setNotice] = useState<{ kind: 'sent' | 'failed'; text: string } | null>(null);

  const rows = useMemo(() => sortInvoices(invoices.data ?? []), [invoices.data]);

  if (statusOf(project.error) === 404) return <ProjectNotFound />;

  const data = project.data;

  // The overview is the bare address; every other tab is `?tab=`. Replacing the entry keeps Back for leaving the page.
  function showTab(next: string) {
    setSearchParams(next === 'overview' ? {} : { tab: next }, { replace: true });
  }

  async function togglePaid(invoice: InvoiceRow) {
    setPaidFailed(false);
    try {
      await setPaid.mutateAsync({ id: invoice.id, paidDate: invoice.paidDate ? null : localToday() });
    } catch {
      setPaidFailed(true);
    }
  }

  async function download(invoice: InvoiceRow) {
    setNotice(null);
    try {
      await downloadInvoicePdf(invoice);
    } catch (error) {
      setNotice({ kind: 'failed', text: notSetUpMessage(error) ?? 'That did not download. Try again.' });
    }
  }

  return (
    <>
      <Link to="/projects" className={backLink}>
        Back to projects
      </Link>
      <PageHeader
        title={data?.name ?? 'Project'}
        badge={data ? <ProjectStatusBadge status={data.projectStatus} /> : undefined}
      >
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
          <Tabs value={tab} onValueChange={showTab}>
            <TabsList aria-label="Project sections">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="invoices">
                <TabLabel label="Invoices" count={invoices.data?.length} />
              </TabsTrigger>
              <TabsTrigger value="resources">
                <TabLabel label="Resources" count={resources.data?.length} />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <ProjectOverview project={data} invoices={invoices.data} />
            </TabsContent>

            <TabsContent value="invoices">
              {paidFailed ? (
                <p role="alert" className="mb-4 text-small font-semibold text-foreground">
                  That did not save. Try again.
                </p>
              ) : null}
              {notice ? (
                <p role={notice.kind === 'failed' ? 'alert' : 'status'} className="mb-4 text-small font-semibold text-foreground">
                  {notice.text}
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
                  <Table aria-label="Invoices">
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
                          <TableCell className="tabular text-right">{formatUsd(invoice.amountCents)}</TableCell>
                          <TableCell>
                            {invoice.paidDate ? (
                              <Badge variant="outline">Paid {formatDate(invoice.paidDate)}</Badge>
                            ) : (
                              <Badge>Unpaid</Badge>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            <IconButton
                              label={`Preview ${invoice.number}`}
                              icon={LuEye}
                              onClick={() => {
                                setNotice(null);
                                setPreviewing(invoice);
                              }}
                            />
                            <IconButton
                              label={`Download ${invoice.number}`}
                              icon={LuDownload}
                              onClick={() => void download(invoice)}
                            />
                            <IconButton
                              label={`Email ${invoice.number}`}
                              icon={LuMail}
                              onClick={() => {
                                setNotice(null);
                                setEmailing(invoice);
                              }}
                            />
                            <IconButton
                              label={`${invoice.paidDate ? 'Mark unpaid' : 'Mark paid'} ${invoice.number}`}
                              icon={invoice.paidDate ? LuUndo2 : LuCircleCheck}
                              disabled={setPaid.isPending}
                              onClick={() => void togglePaid(invoice)}
                            />
                            <IconButton
                              label={`Edit ${invoice.number}`}
                              icon={LuPencil}
                              onClick={() => setInvoiceForm({ open: true, invoice })}
                            />
                            <IconButton
                              label={`Delete ${invoice.number}`}
                              icon={LuTrash2}
                              onClick={() => setInvoiceToDelete(invoice)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </QueryBoundary>
              </Panel>
            </TabsContent>

            <TabsContent value="resources">
              <ResourcesPanel projectId={projectId} billingType={data.billingType} />
            </TabsContent>
          </Tabs>
        ) : null}
      </QueryBoundary>

      <ProjectFormDialog open={projectForm} onOpenChange={setProjectForm} project={data} fallbackFocusId="add-invoice" />

      <InvoiceFormDialog
        open={invoiceForm.open}
        onOpenChange={(open) => setInvoiceForm((current) => ({ ...current, open }))}
        projectId={projectId}
        invoice={invoiceForm.invoice}
        billingType={data?.billingType}
        projectKey={data?.key || undefined}
        projectDiscountPercent={data?.discountPercent}
        fallbackFocusId="add-invoice"
      />

      <ConfirmDialog
        open={deletingProject}
        onOpenChange={setDeletingProject}
        title={`Delete project “${data?.name ?? ''}”?`}
        description="Its resources and invoices are deleted with it. This cannot be undone."
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

      <InvoicePreviewDialog
        open={previewing !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewing(null);
        }}
        invoice={previewing}
        fallbackFocusId="add-invoice"
      />

      <InvoiceEmailDialog
        open={emailing !== null}
        onOpenChange={(open) => {
          if (!open) setEmailing(null);
        }}
        invoice={emailing}
        onSent={(text) => setNotice({ kind: 'sent', text })}
        fallbackFocusId="add-invoice"
      />
    </>
  );
}
