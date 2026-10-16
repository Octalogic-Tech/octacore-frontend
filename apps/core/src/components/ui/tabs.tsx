import type { ComponentProps } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

/** The tabs of one page, resting on a navy rule. Text only: the app's one icon set is for table row actions. */
export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn('mb-6 flex flex-wrap gap-x-8 border-b border-navy', className)}
      {...props}
    />
  );
}

/** A 44px target. Hover and keyboard focus darken the label; the selected tab also carries a teal bar on the rule. */
export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'relative inline-flex min-h-11 items-center font-semibold text-navy-80 hover:text-foreground focus-visible:text-foreground data-[state=active]:text-foreground',
        'after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] data-[state=active]:after:bg-teal',
        className,
      )}
      {...props}
    />
  );
}
