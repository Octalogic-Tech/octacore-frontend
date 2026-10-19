import { LuPencil, LuTrash2 } from 'react-icons/lu';
import { TablePager } from '@/components/table-pager';
import { Badge } from '@/components/ui/badge';
import { IconButton } from '@/components/ui/icon-button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePagedRows } from '@/hooks/use-paged-rows';
import { formatDate } from '@/lib/format';
import { formatUsd } from '@/lib/money';
import { formatMoney, formatRate } from './money';
import type { ExpenseRow } from './schema';

const NONE = '—';

interface ExpenseTableProps {
  rows: readonly ExpenseRow[];
  onEdit: (expense: ExpenseRow) => void;
  onDelete: (expense: ExpenseRow) => void;
}

/**
 * Expenses as a table with a pager. One-time expenses and the charges a recurring expense made look alike, the
 * charge carrying a Recurring tag. Give it a `key` that changes with the filters, so the pager starts again.
 */
export function ExpenseTable({ rows, onEdit, onDelete }: ExpenseTableProps) {
  const paging = usePagedRows(rows);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Person</TableHead>
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
              <TableCell>{expense.person?.name ?? NONE}</TableCell>
              <TableCell className="tabular text-right">
                {formatUsd(expense.amountCents)}
                {expense.originalCountry && expense.originalAmount !== null && expense.exchangeRate !== null ? (
                  <div className="text-small text-navy-72">
                    {formatMoney(expense.originalAmount, expense.originalCountry)} at {formatRate(expense.exchangeRate)}
                  </div>
                ) : null}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right">
                <IconButton
                  label={`Edit ${expense.name}, ${formatDate(expense.chargeDate)}`}
                  icon={LuPencil}
                  onClick={() => onEdit(expense)}
                />
                <IconButton
                  label={`Delete ${expense.name}, ${formatDate(expense.chargeDate)}`}
                  icon={LuTrash2}
                  onClick={() => onDelete(expense)}
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
  );
}
