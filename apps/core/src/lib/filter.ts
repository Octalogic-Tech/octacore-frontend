/** Case-insensitive substring search across the given keys. A blank query keeps every row. */
export function filterBy<T>(rows: T[], query: string, keys: (keyof T)[]): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => keys.some((key) => String(row[key] ?? '').toLowerCase().includes(needle)));
}
