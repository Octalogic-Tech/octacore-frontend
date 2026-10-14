import type { ComponentProps } from 'react';
import { Arm } from '@/components/ui/marks';
import { cn } from '@/lib/utils';

/** A field label led by the arm; the arm lengthens and turns teal while the field has focus. */
export function Label({ className, children, ...props }: ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn('flex min-h-6 items-center gap-2 text-small font-semibold text-foreground', className)}
      {...props}
    >
      <Arm className="w-3 text-rule group-focus-within/field:w-4 group-focus-within/field:text-teal" />
      {children}
    </label>
  );
}
