import { createContext, useContext, useLayoutEffect } from 'react';

/** How a page asks the shell for its whole area: set by the shell, which owns `<main>`. Without a shell it does nothing. */
export const FullMainContext = createContext<(full: boolean) => void>(() => undefined);

/**
 * Called by a page (or a tab of one) that wants the whole area beside the sidebar, edge to edge and down to the bottom
 * of the window, instead of the usual centred column that grows with its content: the allocation board. The shell
 * gives it back when the page unmounts, so a page that is not asking never needs to say so. It is a layout effect, so
 * the first paint already has the right shape.
 */
export function useFullMain() {
  const setFull = useContext(FullMainContext);
  useLayoutEffect(() => {
    setFull(true);
    return () => setFull(false);
  }, [setFull]);
}
