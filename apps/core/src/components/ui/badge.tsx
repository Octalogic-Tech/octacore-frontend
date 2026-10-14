import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex min-h-7 items-center px-2.5 text-small font-semibold', {
  variants: {
    variant: {
      solid: 'bg-navy text-on-navy',
      outline: 'border border-navy text-navy',
    },
  },
  defaultVariants: { variant: 'solid' },
});

/** Status is carried by the word and by fill versus outline, never by colour alone. */
export function Badge({ className, variant, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
