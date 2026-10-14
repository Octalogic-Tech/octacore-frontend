import { useMemo, useState } from 'react';

/** Client-side paging. The page is clamped, so rows disappearing never strands the table past its end. */
export function usePagedRows<T>(rows: readonly T[], initialPageSize = 5) {
  const [requestedPage, setPage] = useState(0);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(requestedPage, pageCount - 1);
  // Keep the clamped page, so rows coming back do not jump the table forward again.
  if (requestedPage !== page) setPage(page);
  const pageRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  function setPageSize(size: number) {
    setPageSizeState(size);
    setPage(0);
  }

  return { page, pageSize, pageCount, pageRows, total: rows.length, setPage, setPageSize };
}
