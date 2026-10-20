import { createContext, useCallback, useContext, useLayoutEffect, useState, type ReactNode } from 'react';

// How many mounted pages ask for the full width. A count, not a flag, so a page that mounts before the one it replaces
// has gone cannot be undone by that one's cleanup. Outside a provider (a page tested on its own) asking does nothing.
const PageWidthContext = createContext<(change: 1 | -1) => void>(() => undefined);

/**
 * Lets a page inside it take the full width of the content area instead of the 75rem cap. `children` is called with
 * whether one does, so the shell can drop the cap on its `<main>`.
 */
export function PageWidthProvider({ children }: { children: (fullWidth: boolean) => ReactNode }) {
  const [wanted, setWanted] = useState(0);
  const change = useCallback((delta: 1 | -1) => setWanted((count) => count + delta), []);
  return <PageWidthContext.Provider value={change}>{children(wanted > 0)}</PageWidthContext.Provider>;
}

/** The calling page takes the full width while it is mounted, set before paint so it never shows capped first. */
export function useFullWidthPage() {
  const change = useContext(PageWidthContext);
  useLayoutEffect(() => {
    change(1);
    return () => change(-1);
  }, [change]);
}
