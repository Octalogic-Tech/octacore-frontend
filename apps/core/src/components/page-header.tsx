import type { ReactNode } from 'react';

/**
 * The page's h1 and its actions on one line, the actions wrapping beneath on narrow screens. A badge sits beside the
 * title and wraps with it.
 */
export function PageHeader({ title, badge, children }: { title: string; badge?: ReactNode; children?: ReactNode }) {
  const heading = <h1 className="text-headline font-semibold text-foreground">{title}</h1>;
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      {badge ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {heading}
          {badge}
        </div>
      ) : (
        heading
      )}
      {children ? <div className="flex flex-wrap items-center gap-3">{children}</div> : null}
    </header>
  );
}
