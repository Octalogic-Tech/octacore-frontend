import type { ComponentProps } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

/** A grey object with a 1px navy frame, as wide as the button that opened it. Flat, and no scrim behind it. */
export function PopoverContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-(--radix-popover-trigger-width) border border-navy bg-background p-3 text-foreground',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
