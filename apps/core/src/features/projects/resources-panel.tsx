import { useState } from 'react';
import { QueryBoundary } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Panel } from '@/components/ui/panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/format';
import { useDeleteResource, useProjectResources } from './api';
import { ResourceFormDialog } from './resource-form-dialog';
import type { BillingType, ResourceRow } from './schema';

const NONE = '—';

interface ResourcesPanelProps {
  projectId: number;
  /** Null on a project from before billing types. Only a retainer builds invoice lines from its resources. */
  billingType: BillingType | null;
}

/** The people on a project, each with the hourly rate they are billed at. */
export function ResourcesPanel({ projectId, billingType }: ResourcesPanelProps) {
  const resources = useProjectResources(projectId);
  const remove = useDeleteResource();
  const [form, setForm] = useState<{ open: boolean; resource?: ResourceRow }>({ open: false });
  const [toDelete, setToDelete] = useState<ResourceRow | null>(null);
  const rows = resources.data ?? [];

  return (
    <section aria-labelledby="resources-heading" className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="resources-heading" className="text-title font-semibold">
          Resources
        </h2>
        <Button id="add-resource" variant="quiet" onClick={() => setForm({ open: true })}>
          Add resource
        </Button>
      </div>

      <Panel>
        <QueryBoundary
          isLoading={resources.isLoading}
          isError={resources.isError}
          onRetry={() => void resources.refetch()}
          isEmpty={rows.length === 0}
          empty={
            <div className="grid justify-items-start gap-1">
              <p className="text-body">No resources yet.</p>
              {billingType === 'retainer' ? (
                <p className="text-small text-navy-72">Resources build the lines of a retainer invoice.</p>
              ) : null}
              <Button variant="quiet" onClick={() => setForm({ open: true })}>
                Add the first resource
              </Button>
            </div>
          }
        >
          <Table aria-label="Resources">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Person</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate per hour</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((resource) => (
                <TableRow key={resource.id}>
                  <TableCell className="font-semibold">{resource.name}</TableCell>
                  <TableCell>{resource.categoryName || NONE}</TableCell>
                  <TableCell>{resource.personName || NONE}</TableCell>
                  <TableCell className="tabular text-right">{resource.headcount}</TableCell>
                  <TableCell className="tabular text-right">{formatCurrency(resource.rate)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button
                      variant="quiet"
                      aria-label={`Edit ${resource.name}`}
                      onClick={() => setForm({ open: true, resource })}
                    >
                      Edit
                    </Button>
                    <Button variant="quiet" aria-label={`Delete ${resource.name}`} onClick={() => setToDelete(resource)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </QueryBoundary>
      </Panel>

      <ResourceFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        projectId={projectId}
        resource={form.resource}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={`Delete resource “${toDelete?.name ?? ''}”?`}
        description="Invoices already built from it keep their lines. This cannot be undone."
        confirmLabel="Delete resource"
        fallbackFocusId="add-resource"
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id);
        }}
      />
    </section>
  );
}
