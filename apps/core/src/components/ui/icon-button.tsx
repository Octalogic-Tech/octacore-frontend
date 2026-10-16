import type { ComponentProps } from 'react';
import type { IconType } from 'react-icons';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type IconButtonProps = Omit<ComponentProps<'button'>, 'children' | 'aria-label' | 'title'> & {
  /** The accessible name and the tooltip. There is no visible text, so say what it does and to what ("Edit Acme"). */
  label: string;
  icon: IconType;
};

/** A table row action: one Lucide mark in a 44px square, in the quiet button's place. */
export function IconButton({ label, icon: Icon, className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      data-slot="button"
      type={type}
      aria-label={label}
      title={label}
      className={cn(buttonVariants({ variant: 'icon' }), className)}
      {...props}
    >
      <Icon aria-hidden="true" focusable="false" className="size-5" />
    </button>
  );
}
