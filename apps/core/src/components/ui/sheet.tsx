import type { ComponentProps } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { CloseMark } from '@/components/ui/marks';
import { cn } from '@/lib/utils';

export const Sheet = DialogPrimitive.Root;

/** A navy panel from the left edge, for the phone and tablet menu. The title is for screen readers. */
export function SheetContent({
  className,
  children,
  title,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { title: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay data-slot="sheet-overlay" className="fixed inset-0 z-50 bg-scrim" />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        aria-describedby={undefined}
        className={cn(
          'on-navy fixed inset-y-0 left-0 z-50 flex w-[min(22rem,100%)] flex-col overflow-y-auto bg-navy text-on-navy',
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
        {children}
        <DialogPrimitive.Close
          aria-label="Close menu"
          className="absolute right-2 top-2 grid size-11 place-items-center text-on-navy"
        >
          <CloseMark className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
