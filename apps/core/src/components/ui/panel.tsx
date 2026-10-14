import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * The website's framed panel: the page grey, a real 1px navy frame, one 45 degree cut at the bottom right.
 * The cut is a small svg over the corner (a grey triangle plus a 1px navy diagonal), not a clip-path,
 * so all four sides weigh the same. Use it on the grey page ground only; dialogs use `cut-br`.
 */
export function Panel({ className, cut = '1.75rem', children, ...props }: ComponentProps<'div'> & { cut?: string }) {
  return (
    <div data-slot="panel" className={cn('relative border border-navy bg-background', className)} {...props}>
      {children}
      <svg
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute -bottom-px -right-px"
        style={{ width: `calc(${cut} + 1px)`, height: `calc(${cut} + 1px)` }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polygon points="100,0 100,100 0,100" fill="var(--color-grey)" />
        <line x1="100" y1="0" x2="0" y2="100" stroke="var(--color-navy)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
