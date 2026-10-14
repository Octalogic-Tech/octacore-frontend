import type { ComponentProps } from 'react';
import { underlineField } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn(underlineField, 'min-h-28 resize-y', className)} {...props} />;
}
