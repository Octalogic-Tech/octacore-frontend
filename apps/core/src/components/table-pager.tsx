import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

interface TablePagerProps {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizes?: number[];
}

export function TablePager({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = [10, 20, 50],
}: TablePagerProps) {
  const id = useId();
  const first = total === 0 ? 0 : page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-rule px-4 py-2 text-small">
      <div className="flex items-center gap-3">
        <label htmlFor={id} className="font-semibold">
          Rows per page
        </label>
        <div className="w-20">
          <Select
            id={id}
            className="min-h-11"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <p aria-live="polite" className="tabular">
        {first}–{last} of {total}
      </p>
      <div className="flex items-center">
        <Button variant="quiet" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button variant="quiet" disabled={page >= pageCount - 1} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
