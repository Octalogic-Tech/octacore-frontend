import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** The website's underline field: a 1px rule that firms to 3px on focus, with padding compensating so nothing moves. */
export const underlineField = cn(
  'block w-full min-h-12 bg-transparent px-0 pt-1 pb-[calc(0.25rem+2px)] text-lead text-foreground placeholder:text-navy-72',
  'rounded-none border-0 border-b border-input outline-none transition-colors',
  'hover:border-foreground focus:border-b-[3px] focus:border-foreground focus:pb-1 focus-visible:outline-none',
  'aria-invalid:border-b-2 aria-invalid:border-foreground aria-invalid:pb-[calc(0.25rem+1px)]',
  'disabled:opacity-50',
);

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return <input data-slot="input" type={type} className={cn(underlineField, className)} {...props} />;
}
