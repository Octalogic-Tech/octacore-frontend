import { useMemo, useState } from 'react';
import { LuPencil, LuTrash2 } from 'react-icons/lu';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { SearchField } from '@/components/search-field';
import { TablePager } from '@/components/table-pager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useExpenseTypes } from '@/features/expense-types/api';
import { useProjects } from '@/features/projects/api';
import { usePagedRows } from '@/hooks/use-paged-rows';
import { downloadCsv } from '@/lib/csv';
import { formatDate, localToday, pluralize } from '@/lib/format';
import { useDeleteExpense, useExpenses, useExpenseSummary, useRecurringExpenses } from './api';
import { expensesToCsv } from './csv';
import { ExpenseFormDialog } from './expense-form-dialog';
import {
  defaultFilters,
  isDefaultFilters,
  isRangeInverted,
  stripQuery,
  toQuery,
  type LedgerFilters,
  type SourceFilter,
} from './filters';
import { formatMoney, formatRate, formatUsd } from './money';
import { costTotals } from './recurring';
import type { ExpenseRow } from './schema';
import { stripFigures } from './summary';
import { SummaryStrip } from './summary-strip';

const NONE = '—';

const SOURCE_CHOICES: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'one-time', label: 'One-time' },
  { value: 'recurring', label: 'Recurring' },
];

/** A select's value is text: an empty one is "all", anything else is an id. */
const toId = (value: string) => (value === '' ? null : Number(value));

export function ExpensesPage() {
  // Read each render, so the default range and the strip follow the date without a reload.
  const today = localToday();
  const [filters, setFilters] = useState<LedgerFilters>(() => defaultFilters(localToday()));
  const [form, setForm] = useState<{ open: boolean; expense?: ExpenseRow }>({ open: false });
  const [toDelete, setToDelete] = useState<ExpenseRow | null>(null);

  const query = useMemo(() => toQuery(filters), [filters]);
  const expenses = useExpenses(query);
  const summary = useExpenseSummary(query);
  const strip = useExpenseSummary(stripQuery(today));
  const recurring = useRecurringExpenses();
  const types = useExpenseTypes();
  const projects = useProjects();
  const remove = useDeleteExpense();

  const rows = useMemo(() => expenses.data ?? [], [expenses.data]);
  const paging = usePagedRows(rows);
  const isDefault = isDefaultFilters(filters, today);
  const figures = strip.data ? stripFigures(strip.data.byMonth, today) : undefined;
  const monthlyRecurring = recurring.data ? costTotals(recurring.data).monthly : undefined;
  const generated = toDelete !== null && toDelete.recurringExpenseId !== null;

  function update(patch: Partial<LedgerFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    paging.setPage(0);
  }

  return (
    <>
      <PageHeader title="Expenses">
        <Button onClick={() => setForm({ open: true })}>Add expense</Button>
      </PageHeader>

      <SummaryStrip figures={figures} monthlyRecurring={monthlyRecurring} />

      <div className="mb-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Type" htmlFor="expense-filter-type">
          <Select
            id="expense-filter-type"
            value={filters.expenseTypeId ?? ''}
            onChange={(event) => update({ expenseTypeId: toId(event.target.value) })}
          >
            <option value="">All types</option>
            {(types.data ?? []).map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Project" htmlFor="expense-filter-project">
          <Select
            id="expense-filter-project"
            value={filters.projectId ?? ''}
            onChange={(event) => update({ projectId: toId(event.target.value) })}
          >
            <option value="">All projects</option>
            {(projects.data ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Source" htmlFor="expense-filter-source">
          <Select
            id="expense-filter-source"
            value={filters.source}
            onChange={(event) => update({ source: event.target.value as SourceFilter })}
          >
            {SOURCE_CHOICES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Charged from" htmlFor="expense-filter-from">
          <Input
            id="expense-filter-from"
            type="date"
            value={filters.from}
            onChange={(event) => update({ from: event.target.value })}
          />
        </Field>
        <Field label="Charged to" htmlFor="expense-filter-to">
          <Input
            id="expense-filter-to"
            type="date"
            value={filters.to}
            onChange={(event) => update({ to: event.target.value })}
          />
        </Field>
      </div>

      <div className="mb-4">
        <SearchField
          id="expense-search"
          label="Search expenses"
          value={filters.q}
          onChange={(value) => update({ q: value })}
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-x-2">
        {isDefault ? null : (
          <Button
            variant="quiet"
            onClick={() => {
              setFilters(defaultFilters(today));
              paging.setPage(0);
            }}
          >
            Clear filters
          </Button>
        )}
        <Button variant="quiet" disabled={rows.length === 0} onClick={() => downloadCsv('expenses.csv', expensesToCsv(rows))}>
          Export CSV
        </Button>
        {summary.data ? (
          <p className="tabular ml-auto text-body font-semibold">
            {pluralize(summary.data.count, 'expense')} · {formatUsd(summary.data.totalCents)}
          </p>
        ) : null}
      </div>

      {isRangeInverted(filters) ? (
        <p role="alert" className="mb-4 text-small font-semibold text-foreground">
          The start date is after the end date.
        </p>
      ) : null}

      <Panel>
        <QueryBoundary
          isLoading={expenses.isLoading}
          isError={expenses.isError}
          onRetry={() => void expenses.refetch()}
          isEmpty={rows.length === 0 && isDefault}
          empty={
            <div className="grid justify-items-start gap-1">
              <p className="text-body">No expenses yet.</p>
              <Button variant="quiet" onClick={() => setForm({ open: true })}>
                Add the first expense
              </Button>
            </div>
          }
        >
          {rows.length === 0 ? (
            <p className="p-6 text-body">No expenses match these filters.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paging.pageRows.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="tabular whitespace-nowrap">{formatDate(expense.chargeDate)}</TableCell>
                      <TableCell>
                        <span className="font-semibold">{expense.name}</span>
                        {expense.recurringExpenseId !== null ? (
                          <Badge variant="outline" className="ml-2">
                            Recurring
                          </Badge>
                        ) : null}
                        {expense.notes ? <div className="text-small text-navy-72">{expense.notes}</div> : null}
                      </TableCell>
                      <TableCell>{expense.expenseType.name}</TableCell>
                      <TableCell>{expense.project?.name ?? NONE}</TableCell>
                      <TableCell className="tabular text-right">
                        {formatUsd(expense.amountCents)}
                        {expense.originalCurrency && expense.originalAmount !== null && expense.exchangeRate !== null ? (
                          <div className="text-small text-navy-72">
                            {formatMoney(expense.originalAmount, expense.originalCurrency)} at{' '}
                            {formatRate(expense.exchangeRate)}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <IconButton
                          label={`Edit ${expense.name}, ${formatDate(expense.chargeDate)}`}
                          icon={LuPencil}
                          onClick={() => setForm({ open: true, expense })}
                        />
                        <IconButton
                          label={`Delete ${expense.name}, ${formatDate(expense.chargeDate)}`}
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
            </>
          )}
        </QueryBoundary>
      </Panel>

      {summary.data && summary.data.byType.length > 0 ? (
        <section aria-labelledby="expenses-by-type" className="mt-8">
          <h2 id="expenses-by-type" className="mb-3 text-title font-semibold">
            By type
          </h2>
          <Panel>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.data.byType.map((row) => (
                  <TableRow key={row.expenseTypeId}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="tabular text-right">{row.count}</TableCell>
                    <TableCell className="tabular text-right">{formatUsd(row.totalCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        </section>
      ) : null}

      <ExpenseFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        expense={form.expense}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={`Delete expense “${toDelete?.name ?? ''}”?`}
        description={
          generated ? 'This cannot be undone. The charge is not created again.' : 'This cannot be undone.'
        }
        confirmLabel="Delete expense"
        fallbackFocusId="expense-search"
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id);
        }}
      />
    </>
  );
}
