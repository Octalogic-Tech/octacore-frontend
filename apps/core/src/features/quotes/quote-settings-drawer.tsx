import type { ReactNode } from 'react';
import { useController, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { QuoteFormValues } from './schema';

type SettingName = Exclude<keyof QuoteFormValues, 'title' | 'lines'>;

interface QuoteSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The editor's own form: the drawer holds no state, so closing it keeps every value and one save stores them.
  register: UseFormRegister<QuoteFormValues>;
  control: Control<QuoteFormValues>;
  errors: FieldErrors<QuoteFormValues>;
  /** The currency the rates are in, as the form stands. */
  currencyCode: string;
  /** Where focus goes on close if the element that opened the drawer is gone. */
  fallbackFocusId?: string;
}

const ROLES = [
  { legend: 'Developer', key: 'developer', count: 'developerCount', rate: 'developerRate' },
  { legend: 'Project manager', key: 'manager', count: 'managerCount', rate: 'managerRate' },
  { legend: 'Tester', key: 'tester', count: 'testerCount', rate: 'testerRate' },
] as const;

// In the order of the calculation: the time buffer pads the hours first, the negotiation buffer pads the amount, and the
// discount comes off that; then the percentages of the hours.
const PERCENTAGES = [
  {
    name: 'timeBufferPercent',
    id: 'quote-time-buffer',
    label: 'Time buffer (%)',
    hint: 'Pads the hours of every line; the price follows.',
  },
  {
    name: 'negotiationBufferPercent',
    id: 'quote-negotiation-buffer',
    label: 'Negotiation buffer (%)',
    hint: 'Added to the subtotal only; it does not change the hours.',
  },
  {
    name: 'discountPercent',
    id: 'quote-discount',
    label: 'Discount (%)',
    hint: 'Taken off after the negotiation buffer is added.',
  },
  {
    name: 'managementPercent',
    id: 'quote-management',
    label: 'Management (%)',
    hint: 'Of the build hours: the lines, testing and bug fixing.',
  },
  {
    name: 'testingPercent',
    id: 'quote-testing',
    label: 'Testing (%)',
    hint: 'Of the hours from the lines, with the time buffer.',
  },
  {
    name: 'bugFixPercent',
    id: 'quote-bug-fixing',
    label: 'Bug fixing (%)',
    hint: 'Of the hours from the lines, with the time buffer.',
  },
] as const;

const TIME = [
  { name: 'hoursPerDay', id: 'quote-hours-per-day', label: 'Hours in a day' },
  { name: 'hoursPerMonth', id: 'quote-hours-per-month', label: 'Hours in a month' },
] as const;

/**
 * Where focus goes as the drawer opens: the first field with a message, in the order the drawer shows them, so a failed
 * save lands on what is wrong; with nothing wrong, the first field as usual.
 */
function focusFirstWrongField(event: Event) {
  const wrong = (event.currentTarget as HTMLElement).querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!wrong) return;
  event.preventDefault();
  // A failed save has react-hook-form focus its own first wrong field on a timer, which is not always this one (the
  // currency is first in the form and last here): ask again after it.
  setTimeout(() => wrong.focus());
}

function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4">
      <legend className="mb-2 text-body font-semibold text-foreground">{legend}</legend>
      {children}
    </fieldset>
  );
}

/**
 * The quote's currency code. Controlled, because the editor shows it twice (above the lines and in the drawer) and two
 * uncontrolled inputs on one field would not show each other's typing.
 */
export function CurrencyInput({
  control,
  id,
  label,
  error,
  hint,
}: {
  control: Control<QuoteFormValues>;
  id: string;
  label: string;
  error?: string;
  hint?: string;
}) {
  const { field } = useController({ control, name: 'currencyCode' });
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <Input
        {...fieldA11y(id, error)}
        name={field.name}
        ref={field.ref}
        value={field.value}
        onChange={field.onChange}
        onBlur={field.onBlur}
        autoComplete="off"
        autoCapitalize="characters"
      />
    </Field>
  );
}

/** The quote's rates and headcounts, percentages, day and month lengths and currency, in a drawer from the right edge. */
export function QuoteSettingsDrawer({
  open,
  onOpenChange,
  register,
  control,
  errors,
  currencyCode,
  fallbackFocusId,
}: QuoteSettingsDrawerProps) {
  const text = (name: SettingName, id: string, label: string, inputMode: 'numeric' | 'decimal', hint?: string) => {
    const message = errors[name]?.message;
    return (
      <Field key={name} label={label} htmlFor={id} error={message} hint={hint}>
        <Input {...fieldA11y(id, message)} {...register(name)} inputMode={inputMode} autoComplete="off" />
      </Field>
    );
  };
  const code = currencyCode.trim().toUpperCase();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        title="Quote settings"
        description="What the totals are worked out from. Saved with the quote."
        fallbackFocusId={fallbackFocusId}
        onOpenAutoFocus={focusFirstWrongField}
      >
        <div className="grid gap-8">
          <Group legend="Rates">
            {/^[A-Z]{3}$/.test(code) ? <p className="text-small text-navy-72">Rates are per hour, in {code}.</p> : null}
            {ROLES.map((role) => (
              <fieldset key={role.key} className="grid gap-4 sm:grid-cols-2">
                <legend className="mb-2 text-small font-semibold text-navy-80">{role.legend}</legend>
                {text(role.count, `quote-${role.key}-count`, 'People', 'numeric')}
                {text(role.rate, `quote-${role.key}-rate`, 'Rate per hour', 'decimal')}
              </fieldset>
            ))}
          </Group>

          <Group legend="Percentages">
            {PERCENTAGES.map((field) => text(field.name, field.id, field.label, 'decimal', field.hint))}
          </Group>

          <Group legend="Time">
            <div className="grid gap-4 sm:grid-cols-2">
              {TIME.map((field) => text(field.name, field.id, field.label, 'numeric'))}
            </div>
          </Group>

          <Group legend="Currency">
            <CurrencyInput
              control={control}
              id="quote-settings-currency"
              label="Currency code"
              error={errors.currencyCode?.message}
              hint="Three letters, like INR or USD."
            />
          </Group>

          {/* The close mark scrolls away with a long drawer, and a phone has no scrim to tap: this is always there. */}
          <div>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
