import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Arm } from '@/components/ui/marks';
import { cn } from '@/lib/utils';

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

/** A label, a control and its message. Errors are navy with an arm, never red. */
export function Field({ label, htmlFor, error, hint, className, children }: FieldProps) {
  return (
    <div data-slot="field" className={cn('group/field grid gap-1', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="flex items-start gap-2 text-small text-foreground">
          <Arm className="mt-[0.85em] w-3 text-foreground" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-small text-navy-72">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Spread onto a control so it is linked to its error message. */
export function fieldA11y(id: string, error?: string) {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
  } as const;
}
