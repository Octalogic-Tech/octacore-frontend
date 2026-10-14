import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SearchFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SearchField({ id, label, value, onChange, className }: SearchFieldProps) {
  return (
    <Field label={label} htmlFor={id} className={cn('w-full sm:max-w-xs', className)}>
      <Input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search…"
        autoComplete="off"
      />
    </Field>
  );
}
