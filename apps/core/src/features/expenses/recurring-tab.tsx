import { useMemo, useState } from 'react';
import { LuBan, LuPause, LuPencil, LuPlay, LuTrash2 } from 'react-icons/lu';
import { QueryBoundary } from '@/components/query-boundary';
import { TablePager } from '@/components/table-pager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { IconButton } from '@/components/ui/icon-button';
import { Panel } from '@/components/ui/panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePagedRows } from '@/hooks/use-paged-rows';
import { serviceMessage } from '@/lib/core-api';
import { formatDate, pluralize } from '@/lib/format';
import { useChangeRecurringState, useDeleteRecurring, useRecurringExpenses } from './api';
import { formatMoney, formatUsd } from './money';
import { RecurringFormDialog } from './recurring-form-dialog';
import { costTotals, sortRecurring } from './recurring';
import { FREQUENCY_LABELS, STATE_LABELS, type RecurringRow, type RecurringState } from './schema';

const NONE = '—';

interface StateAction {
  title: (name: string) => string;
  description: string;
  confirm: string;
}

/** What each move to a state asks, before it is made. */
const ACTIONS: Record<RecurringState, StateAction> = {
  paused: {
    title: (name) => `Pause “${name}”?`,
    description: 'No charges are created while it is paused. When you resume it, the charges it missed are not created.',
    confirm: 'Pause',
  },
  active: {
    title: (name) => `Resume “${name}”?`,
    description: 'Charges start again from the first charge date on or after today.',
    confirm: 'Resume',
  },
  cancelled: {
    title: (name) => `Cancel “${name}”?`,
    description: 'It stops creating charges. You can reactivate it later.',
    confirm: 'Cancel recurring expense',
  },
};

function StateBadge({ state }: { state: RecurringState }) {
  return <Badge variant={state === 'active' ? 'solid' : 'outline'}>{STATE_LABELS[state]}</Badge>;
}

/** The recurring expenses, and what the active ones cost: add one, change it, pause it, resume it, end it. */
export function RecurringTab() {
  const recurring = useRecurringExpenses();
  const changeState = useChangeRecurringState();
  const remove = useDeleteRecurring();
  const [form, setForm] = useState<{ open: boolean; expense?: RecurringRow }>({ open: false });
  const [action, setAction] = useState<{ expense: RecurringRow; state: RecurringState } | null>(null);
  const [toDelete, setToDelete] = useState<RecurringRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const rows = useMemo(() => sortRecurring(recurring.data ?? []), [recurring.data]);
  const totals = useMemo(() => costTotals(recurring.data ?? []), [recurring.data]);
  const paging = usePagedRows(rows);
  const pending = action ? ACTIONS[action.state] : null;

  function saved(generated: number) {
    setProblem(null);
    setNotice(generated > 0 ? `Created ${pluralize(generated, 'charge')}.` : 'Saved. No charge is due yet.');
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {recurring.data ? (
          <p className="tabular text-body font-semibold">
            Active: {formatUsd(totals.monthly)} per month · {formatUsd(totals.yearly)} per year
          </p>
        ) : (
          <span />
        )}
        <Button id="recurring-add" onClick={() => setForm({ open: true })}>
          Add recurring expense
        </Button>
      </div>

      {notice ? (
        <p role="status" className="mb-4 text-small font-semibold text-foreground">
          {notice}
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="mb-4 text-small font-semibold text-foreground">
          {problem}
        </p>
      ) : null}

      <Panel>
        <QueryBoundary
          isLoading={recurring.isLoading}
          isError={recurring.isError}
          onRetry={() => void recurring.refetch()}
          isEmpty={rows.length === 0}
          empty={
            <div className="grid justify-items-start gap-1">
              <p className="text-body">No recurring expenses yet.</p>
              <Button variant="quiet" onClick={() => setForm({ open: true })}>
                Add the first recurring expense
              </Button>
            </div>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Person</TableHead>
                <TableHead className="text-right">Charge</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next charge</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paging.pageRows.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>
                    <span className="font-semibold">{expense.name}</span>
                    {expense.notes ? <div className="text-small text-navy-72">{expense.notes}</div> : null}
                  </TableCell>
                  <TableCell>{expense.expenseType.name}</TableCell>
                  <TableCell>{expense.person?.name ?? NONE}</TableCell>
                  <TableCell className="tabular text-right">
                    {expense.currency.code === 'USD' ? (
                      formatUsd(expense.amountCents)
                    ) : (
                      <>
                        {formatMoney(expense.amount, expense.currency)}
                        <div className="text-small text-navy-72">about {formatUsd(expense.amountCents)}</div>
                      </>
                    )}
                  </TableCell>
                  <TableCell>{FREQUENCY_LABELS[expense.frequency]}</TableCell>
                  <TableCell className="tabular whitespace-nowrap">
                    {expense.nextChargeDate ? formatDate(expense.nextChargeDate) : 'Ended'}
                  </TableCell>
                  <TableCell>
                    <StateBadge state={expense.state} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <IconButton
                      label={`Edit ${expense.name}`}
                      icon={LuPencil}
                      onClick={() => setForm({ open: true, expense })}
                    />
                    {expense.state === 'active' ? (
                      <IconButton
                        label={`Pause ${expense.name}`}
                        icon={LuPause}
                        onClick={() => setAction({ expense, state: 'paused' })}
                      />
                    ) : null}
                    {expense.state === 'paused' ? (
                      <IconButton
                        label={`Resume ${expense.name}`}
                        icon={LuPlay}
                        onClick={() => setAction({ expense, state: 'active' })}
                      />
                    ) : null}
                    {expense.state === 'cancelled' ? (
                      <IconButton
                        label={`Reactivate ${expense.name}`}
                        icon={LuPlay}
                        onClick={() => setAction({ expense, state: 'active' })}
                      />
                    ) : (
                      <IconButton
                        label={`Cancel ${expense.name}`}
                        icon={LuBan}
                        onClick={() => setAction({ expense, state: 'cancelled' })}
                      />
                    )}
                    <IconButton
                      label={`Delete ${expense.name}`}
                      icon={LuTrash2}
                      onClick={() => setToDelete(expense)}
                    />
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
        </QueryBoundary>
      </Panel>

      <RecurringFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        expense={form.expense}
        onSaved={saved}
      />

      <ConfirmDialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
        title={action && pending ? pending.title(action.expense.name) : ''}
        description={pending?.description ?? ''}
        confirmLabel={pending?.confirm ?? ''}
        fallbackFocusId="recurring-add"
        onConfirm={async () => {
          if (!action) return;
          setNotice(null);
          try {
            await changeState.mutateAsync({ id: action.expense.id, state: action.state });
            setProblem(null);
          } catch (error) {
            // A resume after the end date is a 422 with the reason: it is shown on the page, once this closes.
            setProblem(serviceMessage(error) ?? 'That did not work. Try again.');
          }
        }}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={`Delete recurring expense “${toDelete?.name ?? ''}”?`}
        description="It stops creating charges. The charges it made stay in the ledger. This cannot be undone."
        confirmLabel="Delete recurring expense"
        fallbackFocusId="recurring-add"
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id);
        }}
      />
    </>
  );
}
