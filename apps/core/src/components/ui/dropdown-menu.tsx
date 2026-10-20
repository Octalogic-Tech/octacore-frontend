import type { ComponentProps } from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;

/** A grey object with a 1px navy frame, like the account popover: flat, square, and no scrim behind it. */
export function DropdownMenuContent({
  className,
  sideOffset = 4,
  align = 'end',
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-50 min-w-48 max-w-[min(20rem,calc(100vw-2rem))] border border-navy bg-background text-foreground',
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

/** What the group below is for ("Move to"): Slate Navy, small, and not a choice. */
export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn(
        'flex min-h-11 items-center border-b border-rule px-3 text-small font-semibold text-navy-80',
        className
      )}
      {...props}
    />
  );
}

/** A 44px choice. The one in focus (by arrow key or by pointer) is a Soft Hairline fill with a teal bar on its left. */
export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        'relative flex min-h-11 cursor-default select-none items-center px-3 text-body outline-none',
        'data-[highlighted]:bg-accent data-[highlighted]:before:absolute data-[highlighted]:before:inset-y-0 data-[highlighted]:before:left-0 data-[highlighted]:before:w-[3px] data-[highlighted]:before:bg-teal',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    />
  );
}
