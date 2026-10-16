import { useMemo, useState } from 'react';
import { QueryBoundary } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Panel } from '@/components/ui/panel';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useExpenseTypes } from '@/features/expense-types/api';
import { usePeople } from '@/features/people/api';
import { useProjects } from '@/features/projects/api';
import { useExpenses } from './api';
import { DeleteExpenseDialog } from './delete-expense-dialog';
import { ExpenseFormDialog } from './expense-form-dialog';
import { ExpenseTable } from './expense-table';
import { NO_OVERVIEW_FILTERS, hasOverviewFilters, toOverviewQuery, type OverviewFilters } from './filters';
import { formatUsd } from './money';
import { monthLabel, shiftMonth } from './months';
import { monthFigures } from './overview';
import type { ExpenseRow } from './schema';

interface OverviewTabProps {
  /** The month shown, `YYYY-MM`. */
  month: string;
  /** This month, so the way back to it is only offered from another. */
  thisMonth: string;
  onMonthChange: (month: string) => void;
}

/** A select's value is text: an empty one is "all", anything else is an id. */
const toId = (value: string) => (value === '' ? null : Number(value));

/** One month of spending: what it came to, split into one-time and recurring, by type, and every expense in it. */
export function OverviewTab({ month, thisMonth, onMonthChange }: OverviewTabProps) {
  const [filters, setFilters] = useState<OverviewFilters>(NO_OVERVIEW_FILTERS);
  const [form, setForm] = useState<{ open: boolean; expense?: ExpenseRow }>({ open: false });
  const [toDelete, setToDelete] = useState<ExpenseRow | null>(null);

  const query = useMemo(() => toOverviewQuery(month, filters), [month, filters]);
  const expenses = useExpenses(query);
  const types = useExpenseTypes();
  const projects = useProjects();
  const people = usePeople();

  // While another month (or filter) loads, the data of the one before is still on hand. It is not shown: figures
  // and rows under a heading that names a different month would be wrong.
  const loaded = expenses.data !== undefined && !expenses.isPlaceholderData;
  const rows = useMemo(() => (loaded ? (expenses.data ?? []) : []), [loaded, expenses.data]);
  const figures = useMemo(() => monthFigures(rows), [rows]);
  const filtered = hasOverviewFilters(filters);
  const label = monthLabel(month);

  const summary = [
    { name: 'Total', cents: figures.total },
    { name: 'One-time', cents: figures.oneTime },
    { name: 'Recurring', cents: figures.recurring },
  ];

  function update(patch: Partial<OverviewFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-2">
          <Button variant="quiet" onClick={() => onMonthChange(shiftMonth(month, -1))}>
            Previous month
          </Button>
          <h2 className="text-title font-semibold">{label}</h2>
          <Button variant="quiet" onClick={() => onMonthChange(shiftMonth(month, 1))}>
            Next month
          </Button>
          {month === thisMonth ? null : (
            <Button variant="quiet" onClick={() => onMonthChange(thisMonth)}>
              This month
            </Button>
          )}
        </div>
        <Button id="overview-add" onClick={() => setForm({ open: true })}>
          Add expense
        </Button>
      </div>

      <dl aria-label={`Spend in ${label}`} className="mb-6 grid gap-x-6 gap-y-4 sm:grid-cols-3">
        {summary.map(({ name, cents }) => (
          <div key={name}>
            <dt className="text-small text-navy-72">{name}</dt>
            <dd className="tabular text-title font-semibold">{loaded ? formatUsd(cents) : '—'}</dd>
          </div>
        ))}
      </dl>

      <div className="mb-4 grid gap-x-6 gap-y-4 sm:grid-cols-3">
        <Field label="Type" htmlFor="overview-filter-type">
          <Select
            id="overview-filter-type"
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
        <Field label="Project" htmlFor="overview-filter-project">
          <Select
            id="overview-filter-project"
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
        <Field label="Person" htmlFor="overview-filter-person">
          <Select
            id="overview-filter-person"
            value={filters.personId ?? ''}
            onChange={(event) => update({ personId: toId(event.target.value) })}
          >
            <option value="">All people</option>
            {(people.data ?? []).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {filtered ? (
        <div className="mb-6">
          <Button variant="quiet" onClick={() => setFilters(NO_OVERVIEW_FILTERS)}>
            Clear filters
          </Button>
        </div>
      ) : null}

      <Panel>
        <QueryBoundary
          isLoading={expenses.isLoading || expenses.isPlaceholderData}
          isError={expenses.isError}
          onRetry={() => void expenses.refetch()}
          isEmpty={rows.length === 0 && !filtered}
          empty={
            <div className="grid justify-items-start gap-1">
              <p className="text-body">No expenses in {label}.</p>
              <Button variant="quiet" onClick={() => setForm({ open: true })}>
                Add an expense
              </Button>
            </div>
          }
        >
          {rows.length === 0 ? (
            <p className="p-6 text-body">No expenses match these filters.</p>
          ) : (
            <ExpenseTable
              key={`${month}|${JSON.stringify(filters)}`}
              rows={rows}
              onEdit={(expense) => setForm({ open: true, expense })}
              onDelete={setToDelete}
            />
          )}
        </QueryBoundary>
      </Panel>

      {figures.byType.length > 0 ? (
        <section aria-labelledby="overview-by-type" className="mt-8">
          <h3 id="overview-by-type" className="mb-3 text-title font-semibold">
            By type
          </h3>
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
                {figures.byType.map((row) => (
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
        fallbackFocusId="overview-add"
      />
      <DeleteExpenseDialog expense={toDelete} onClose={() => setToDelete(null)} fallbackFocusId="overview-add" />
    </>
  );
}
