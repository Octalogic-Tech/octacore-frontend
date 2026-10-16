import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ChoiceChipProps = Omit<ComponentProps<'input'>, 'type' | 'children'> & { children: ReactNode };

/**
 * One choice among several, as a native checkbox drawn as a 44px chip: the chosen chip is a navy block. The box is
 * visually hidden but stays in the tab order, and keyboard focus puts a teal bar under the chip, as on the buttons.
 */
export function ChoiceChip({ className, children, ...props }: ChoiceChipProps) {
  return (
    <label
      data-slot="choice-chip"
      className={cn(
        'relative inline-flex min-h-11 cursor-pointer items-center border border-navy px-4 font-semibold text-navy',
        'has-[:checked]:bg-navy has-[:checked]:text-on-navy',
        'after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] has-[:focus-visible]:after:bg-teal',
        'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60',
        className,
      )}
    >
      <input type="checkbox" className="sr-only" {...props} />
      {children}
    </label>
  );
}
