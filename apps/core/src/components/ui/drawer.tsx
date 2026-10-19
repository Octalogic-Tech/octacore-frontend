import type { ComponentProps, ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { DialogDescription } from '@/components/ui/dialog';
import { CloseMark } from '@/components/ui/marks';
import { useReturnFocus } from '@/hooks/use-return-focus';
import { cn } from '@/lib/utils';

export const Drawer = DialogPrimitive.Root;

/**
 * A grey panel from the right edge, full height, with a hairline on its left side, over the same scrim as a
 * dialog. It is for settings that sit beside a page, where a dialog would hide what the settings change. The
 * title is visible; a description is optional. Focus goes back to whatever opened it.
 */
export function DrawerContent({
  title,
  description,
  className,
  children,
  fallbackFocusId,
  ...props
}: Omit<ComponentProps<typeof DialogPrimitive.Content>, 'title'> & {
  title: string;
  description?: string;
  children?: ReactNode;
  /** Where focus goes on close if the element that opened the drawer is gone. */
  fallbackFocusId?: string;
}) {
  const returnFocus = useReturnFocus(fallbackFocusId);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay data-slot="drawer-overlay" className="fixed inset-0 z-50 bg-scrim" />
      <DialogPrimitive.Content
        data-slot="drawer-content"
        onOpenAutoFocus={returnFocus.onOpenAutoFocus}
        onCloseAutoFocus={returnFocus.onCloseAutoFocus}
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-[min(28rem,100%)] overflow-y-auto border-l border-rule bg-background p-6 sm:p-8',
          className,
        )}
        {...props}
      >
        <DrawerTitle>{title}</DrawerTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
        <div className="mt-6">{children}</div>
        <DialogPrimitive.Close
          aria-label="Close"
          className="absolute right-2 top-2 grid size-11 place-items-center text-foreground"
        >
          <CloseMark className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DrawerTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="drawer-title"
      className={cn('pr-10 text-title font-semibold text-foreground', className)}
      {...props}
    />
  );
}
