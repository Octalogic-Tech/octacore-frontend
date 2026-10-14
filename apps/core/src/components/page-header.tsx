import type { ReactNode } from 'react';

/** The page's h1 and its actions on one line, the actions wrapping beneath on narrow screens. */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <h1 className="text-headline font-semibold text-foreground">{title}</h1>
      {children ? <div className="flex flex-wrap items-center gap-3">{children}</div> : null}
    </header>
  );
}
