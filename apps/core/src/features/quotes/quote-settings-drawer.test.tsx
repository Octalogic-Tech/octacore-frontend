import { zodResolver } from '@hookform/resolvers/zod';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { QuoteSettingsDrawer } from './quote-settings-drawer';
import { emptyQuoteForm, quoteFormSchema, type QuoteFormValues } from './schema';

/** The drawer on a form of its own, with the form's values printed outside it so a test can read them. */
function Harness() {
  const [open, setOpen] = useState(true);
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    mode: 'onTouched',
    defaultValues: emptyQuoteForm,
  });
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <pre data-testid="values">{JSON.stringify(watch())}</pre>
      <QuoteSettingsDrawer
        open={open}
        onOpenChange={setOpen}
        register={register}
        control={control}
        errors={errors}
        currencyCode="INR"
      />
    </>
  );
}

const values = () => JSON.parse(screen.getByTestId('values').textContent ?? '{}') as QuoteFormValues;
const drawer = () => screen.getByRole('dialog', { name: 'Quote settings' });

// [group, label, form field, default, typed]
const FIELDS: [string, string, keyof QuoteFormValues, string, string][] = [
  ['Developer', 'People', 'developerCount', '3', '4'],
  ['Developer', 'Rate per hour', 'developerRate', '3100.00', '1000.00'],
  ['Project manager', 'People', 'managerCount', '1', '2'],
  ['Project manager', 'Rate per hour', 'managerRate', '3000.00', '2500.50'],
  ['Tester', 'People', 'testerCount', '1', '3'],
  ['Tester', 'Rate per hour', 'testerRate', '0.00', '800'],
  ['Percentages', 'Negotiation buffer (%)', 'negotiationBufferPercent', '25', '10'],
  ['Percentages', 'Management (%)', 'managementPercent', '25', '12.5'],
  ['Percentages', 'Testing (%)', 'testingPercent', '0', '10'],
  ['Percentages', 'Bug fixing (%)', 'bugFixPercent', '0', '5'],
  ['Time', 'Hours in a day', 'hoursPerDay', '6', '8'],
  ['Time', 'Hours in a month', 'hoursPerMonth', '160', '150'],
  ['Currency', 'Currency code', 'currencyCode', 'INR', 'USD'],
];

describe('QuoteSettingsDrawer', () => {
  it.each(FIELDS)('%s: %s shows the form’s value and edits it', async (group, label, name, initial, typed) => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = within(within(drawer()).getByRole('group', { name: group })).getByLabelText(label);
    expect(input).toHaveValue(initial);
    await user.clear(input);
    await user.type(input, typed);
    expect(values()[name]).toBe(typed);
  });

  it('gives every field its id', () => {
    render(<Harness />);
    for (const id of [
      'quote-developer-count',
      'quote-developer-rate',
      'quote-manager-count',
      'quote-manager-rate',
      'quote-tester-count',
      'quote-tester-rate',
      'quote-negotiation-buffer',
      'quote-management',
      'quote-testing',
      'quote-bug-fixing',
      'quote-hours-per-day',
      'quote-hours-per-month',
      'quote-settings-currency',
    ]) {
      expect(document.getElementById(id)).toBeInTheDocument();
    }
  });

  it('says what each percentage applies to and what the rates are in', () => {
    render(<Harness />);
    const percentages = within(drawer()).getByRole('group', { name: 'Percentages' });
    expect(within(percentages).getByText('Added to the subtotal.')).toBeInTheDocument();
    expect(within(percentages).getByText('Of the build hours: the lines, testing and bug fixing.')).toBeInTheDocument();
    expect(within(percentages).getAllByText('Of the base hours from the lines.')).toHaveLength(2);
    expect(within(drawer()).getByText('Rates are per hour, in INR.')).toBeInTheDocument();
  });

  it('shows a field’s message', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const testing = within(drawer()).getByLabelText('Testing (%)');
    await user.clear(testing);
    await user.type(testing, 'abc');
    await user.tab();
    expect(await within(drawer()).findByText('Enter a percentage like 7.5')).toBeInTheDocument();
    expect(testing).toHaveAttribute('aria-invalid', 'true');
  });

  it('ends with a Done button that closes it, and reopening keeps what was typed', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const rate = within(within(drawer()).getByRole('group', { name: 'Developer' })).getByLabelText('Rate per hour');
    await user.clear(rate);
    await user.type(rate, '1000.00');
    await user.click(within(drawer()).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(within(within(drawer()).getByRole('group', { name: 'Developer' })).getByLabelText('Rate per hour')).toHaveValue(
      '1000.00',
    );
  });
});
