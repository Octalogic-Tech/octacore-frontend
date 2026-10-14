import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ArmArrow } from '@/components/ui/marks';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'group/button inline-flex font-semibold leading-tight select-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'min-h-[3.25rem] items-stretch bg-primary text-primary-foreground',
        quiet:
          'min-h-11 items-center px-3 text-foreground decoration-teal decoration-2 underline-offset-[0.25em] hover:underline focus-visible:underline',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
);

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

/** A label and a square arm cell; the arm does the signalling. One primary button per screen. */
export function Button({ className, variant, type = 'button', children, ...props }: ButtonProps) {
  return (
    <button data-slot="button" type={type} className={cn(buttonVariants({ variant }), className)} {...props}>
      {variant === 'quiet' ? (
        children
      ) : (
        <>
          <span className="flex items-center px-[1.4rem] py-3">{children}</span>
          <span
            aria-hidden="true"
            className="grid w-[3.25rem] flex-none place-items-center bg-navy-deep text-teal shadow-[inset_1px_0_0_rgb(255_255_255/0.08)] transition-colors duration-200 ease-out-quart group-hover/button:bg-teal group-hover/button:text-navy group-focus-visible/button:bg-teal group-focus-visible/button:text-navy"
          >
            <ArmArrow className="size-[1.6rem]" />
          </span>
        </>
      )}
    </button>
  );
}
