import { act, renderHook } from '@testing-library/react';
import { usePagedRows } from './use-paged-rows';

const rows = Array.from({ length: 12 }, (_, index) => index + 1);

describe('usePagedRows', () => {
  it('shows ten rows per page by default', () => {
    const { result } = renderHook(() => usePagedRows(rows));
    expect(result.current.pageSize).toBe(10);
    expect(result.current.pageRows).toHaveLength(10);
    expect(result.current.pageCount).toBe(2);
  });

  it('slices the current page', () => {
    const { result } = renderHook(() => usePagedRows(rows, 5));
    expect(result.current.pageRows).toEqual([1, 2, 3, 4, 5]);
    expect(result.current.pageCount).toBe(3);
    act(() => result.current.setPage(2));
    expect(result.current.pageRows).toEqual([11, 12]);
    expect(result.current.total).toBe(12);
  });

  it('clamps to the last page when the rows shrink under it', () => {
    const { result, rerender } = renderHook(({ data }) => usePagedRows(data, 5), { initialProps: { data: rows } });
    act(() => result.current.setPage(2));
    rerender({ data: rows.slice(0, 10) });
    expect(result.current.page).toBe(1);
    expect(result.current.pageRows).toEqual([6, 7, 8, 9, 10]);
  });

  it('stays on the clamped page when rows come back, instead of jumping to the old page', () => {
    const { result, rerender } = renderHook(({ data }) => usePagedRows(data, 5), { initialProps: { data: rows } });
    act(() => result.current.setPage(2));
    rerender({ data: rows.slice(0, 10) });
    expect(result.current.page).toBe(1);
    rerender({ data: rows });
    expect(result.current.page).toBe(1);
  });

  it('goes back to the first page when the page size changes', () => {
    const { result } = renderHook(() => usePagedRows(rows, 5));
    act(() => result.current.setPage(2));
    act(() => result.current.setPageSize(10));
    expect(result.current.page).toBe(0);
    expect(result.current.pageRows).toHaveLength(10);
  });

  it('has one empty page when there are no rows', () => {
    const { result } = renderHook(() => usePagedRows([], 5));
    expect(result.current.pageCount).toBe(1);
    expect(result.current.page).toBe(0);
    expect(result.current.pageRows).toEqual([]);
  });
});
