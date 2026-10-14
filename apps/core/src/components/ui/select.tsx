import type { ComponentProps } from 'react';
import { underlineField } from '@/components/ui/input';
import { ChevronDownMark } from '@/components/ui/marks';
import { cn } from '@/lib/utils';

/** A native select (best on phones and for keyboards) with the website's underline field and a drawn chevron. */
export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select data-slot="select" className={cn(underlineField, 'appearance-none pr-8', className)} {...props}>
        {children}
      </select>
      <ChevronDownMark className="pointer-events-none absolute right-0 top-1/2 size-4 -translate-y-1/2 text-foreground" />
    </div>
  );
}
