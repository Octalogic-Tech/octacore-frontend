import { useMemo, useState } from 'react';
import { QueryBoundary } from '@/components/query-boundary';
import { SearchField } from '@/components/search-field';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { Select } from '@/components/ui/select';
import { useExpenseTypes } from '@/features/expense-types/api';
import { usePeople } from '@/features/people/api';
import { useProjects } from '@/features/projects/api';
import { downloadCsv } from '@/lib/csv';
import { localToday, pluralize } from '@/lib/format';
import { useExpenses } from './api';
import { expensesToCsv } from './csv';
import { DeleteExpenseDialog } from './delete-expense-dialog';
import { ExpenseFormDialog } from './expense-form-dialog';
import { ExpenseTable } from './expense-table';
import {
  defaultOneTimeFilters,
  isDefaultOneTimeFilters,
  isRangeInverted,
  toOneTimeQuery,
  type OneTimeFilters,
} from './filters';
import { formatUsd } from './money';
import type { ExpenseRow } from './schema';

/** A select's value is text: an empty one is "all", anything else is an id. */
const toId = (value: string) => (value === '' ? null : Number(value));

/** The expenses typed in by hand, any month: filter them, total them, export them. Generated charges are not here. */
export function OneTimeTab() {
  // Read each render, so the default range follows the date without a reload.
  const today = localToday();
  const [filters, setFilters] = useState<OneTimeFilters>(() => defaultOneTimeFilters(localToday()));
  const [form, setForm] = useState<{ open: boolean; expense?: ExpenseRow }>({ open: false });
  const [toDelete, setToDelete] = useState<ExpenseRow | null>(null);

  const query = useMemo(() => toOneTimeQuery(filters), [filters]);
  const expenses = useExpenses(query);
  const types = useExpenseTypes();
  const projects = useProjects();
  const people = usePeople();

  const rows = useMemo(() => expenses.data ?? [], [expenses.data]);
  const total = useMemo(() => rows.reduce((sum, row) => sum + row.amountCents, 0), [rows]);
  const isDefault = isDefaultOneTimeFilters(filters, today);

  function update(patch: Partial<OneTimeFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  return (
    <>
      <div className="mb-6 flex justify-end">
        <Button id="one-time-add" onClick={() => setForm({ open: true })}>
          Add expense
        </Button>
      </div>

      <div className="mb-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Type" htmlFor="one-time-filter-type">
          <Select
            id="one-time-filter-type"
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
        <Field label="Project" htmlFor="one-time-filter-project">
          <Select
            id="one-time-filter-project"
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
        <Field label="Person" htmlFor="one-time-filter-person">
          <Select
            id="one-time-filter-person"
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
        <Field label="Charged from" htmlFor="one-time-filter-from">
          <Input
            id="one-time-filter-from"
            type="date"
            value={filters.from}
            onChange={(event) => update({ from: event.target.value })}
          />
        </Field>
        <Field label="Charged to" htmlFor="one-time-filter-to">
          <Input
            id="one-time-filter-to"
            type="date"
            value={filters.to}
            onChange={(event) => update({ to: event.target.value })}
          />
        </Field>
      </div>

      <div className="mb-4">
        <SearchField
          id="one-time-search"
          label="Search expenses"
          value={filters.q}
          onChange={(value) => update({ q: value })}
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-x-2">
        {isDefault ? null : (
          <Button variant="quiet" onClick={() => setFilters(defaultOneTimeFilters(today))}>
            Clear filters
          </Button>
        )}
        <Button variant="quiet" disabled={rows.length === 0} onClick={() => downloadCsv('expenses.csv', expensesToCsv(rows))}>
          Export CSV
        </Button>
        {expenses.data ? (
          <p className="tabular ml-auto text-body font-semibold">
            {pluralize(rows.length, 'expense')} · {formatUsd(total)}
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
              <p className="text-body">No one-time expenses yet.</p>
              <Button variant="quiet" onClick={() => setForm({ open: true })}>
                Add the first expense
              </Button>
            </div>
          }
        >
          {rows.length === 0 ? (
            <p className="p-6 text-body">No expenses match these filters.</p>
          ) : (
            <ExpenseTable
              key={JSON.stringify(query)}
              rows={rows}
              onEdit={(expense) => setForm({ open: true, expense })}
              onDelete={setToDelete}
            />
          )}
        </QueryBoundary>
      </Panel>

      <ExpenseFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        expense={form.expense}
        fallbackFocusId="one-time-search"
      />
      <DeleteExpenseDialog expense={toDelete} onClose={() => setToDelete(null)} fallbackFocusId="one-time-search" />
    </>
  );
}
