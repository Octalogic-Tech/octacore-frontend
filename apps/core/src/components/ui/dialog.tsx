import type { ComponentProps } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { CloseMark } from '@/components/ui/marks';
import { useReturnFocus } from '@/hooks/use-return-focus';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;

/** A grey object on the scrim with the website's one 45 degree cut at the bottom right. */
export function DialogContent({
  className,
  children,
  fallbackFocusId,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  /** Where focus goes on close if the element that opened the dialog is gone. */
  fallbackFocusId?: string;
}) {
  const returnFocus = useReturnFocus(fallbackFocusId);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay data-slot="dialog-overlay" className="fixed inset-0 z-50 bg-scrim" />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        onOpenAutoFocus={returnFocus.onOpenAutoFocus}
        onCloseAutoFocus={returnFocus.onCloseAutoFocus}
        className={cn(
          'cut-br fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto bg-background p-6 [--cut:1.75rem] sm:p-8',
          className,
        )}
        {...props}
      >
        {children}
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

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('pr-10 text-title font-semibold text-foreground', className)}
      {...props}
    />
  );
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('mt-2 text-body text-navy-80', className)}
      {...props}
    />
  );
}
