import { zodResolver } from '@hookform/resolvers/zod';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { QuoteSettingsDrawer } from './quote-settings-drawer';
import { emptyQuoteForm, quoteFormSchema, type QuoteFormValues } from './schema';

/**
 * The drawer on a form of its own, with the form's values printed outside it so a test can read them. `wrong` starts the
 * form with those values and asks for every field's message at once, as a failed save does, and `open` is whether the
 * drawer starts open.
 */
function Harness({ wrong, open: startOpen = true }: { wrong?: Partial<QuoteFormValues>; open?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const {
    register,
    control,
    watch,
    trigger,
    formState: { errors },
  } = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    mode: 'onTouched',
    defaultValues: { ...emptyQuoteForm, ...wrong },
  });
  useEffect(() => {
    if (wrong) void trigger();
  }, [trigger, wrong]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <pre data-testid="values">{JSON.stringify(watch())}</pre>
      <p data-testid="wrong">{Object.keys(errors).join(',')}</p>
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
  ['Percentages', 'Time buffer (%)', 'timeBufferPercent', '0', '12.5'],
  ['Percentages', 'Negotiation buffer (%)', 'negotiationBufferPercent', '25', '10'],
  ['Percentages', 'Discount (%)', 'discountPercent', '0', '7.5'],
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
      'quote-time-buffer',
      'quote-negotiation-buffer',
      'quote-discount',
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
    expect(within(percentages).getByText('Pads the hours of every line; the price follows.')).toBeInTheDocument();
    expect(
      within(percentages).getByText('Added to the subtotal only; it does not change the hours.'),
    ).toBeInTheDocument();
    expect(within(percentages).getByText('Taken off after the negotiation buffer is added.')).toBeInTheDocument();
    expect(within(percentages).getByText('Of the build hours: the lines, testing and bug fixing.')).toBeInTheDocument();
    // Testing and bug fixing are percentages of the hours with the time buffer, not of the lines' own hours.
    expect(within(percentages).getAllByText('Of the hours from the lines, with the time buffer.')).toHaveLength(2);
    expect(within(percentages).queryByText(/base hours/)).toBeNull();
    expect(within(drawer()).getByText('Rates are per hour, in INR.')).toBeInTheDocument();
  });

  it('shows the percentages in the order of the calculation: time buffer, negotiation buffer, discount, then the hours', () => {
    render(<Harness />);
    const percentages = within(drawer()).getByRole('group', { name: 'Percentages' });
    const labels = within(percentages)
      .getAllByRole('textbox')
      .map((input) => (input as HTMLInputElement).labels?.[0]?.textContent);
    expect(labels).toEqual([
      'Time buffer (%)',
      'Negotiation buffer (%)',
      'Discount (%)',
      'Management (%)',
      'Testing (%)',
      'Bug fixing (%)',
    ]);
  });

  it.each([
    ['Time buffer (%)', '100.01', 'Percentage must be from 0 to 100'],
    ['Discount (%)', '50.01', 'Discount must be from 0 to 50'],
    ['Discount (%)', 'abc', 'Enter a percentage like 7.5'],
  ])('tells %s of %j: %s', async (label, text, message) => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = within(drawer()).getByLabelText(label);
    await user.clear(input);
    await user.type(input, text);
    await user.tab();
    expect(await within(drawer()).findByText(message)).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
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

  describe('opening with something wrong', () => {
    // Out of the form's own order on purpose: the drawer shows the rate first, then Testing, and the currency last.
    const WRONG = { currencyCode: 'RUPEES', testingPercent: 'abc', developerRate: '3,100' };

    it('puts focus on the first wrong field the drawer shows, and gives it back to the opener on Done', async () => {
      const user = userEvent.setup();
      render(<Harness wrong={WRONG} open={false} />);
      await waitFor(() => expect(screen.getByTestId('wrong')).toHaveTextContent('currencyCode,developerRate,testingPercent'));
      await user.click(screen.getByRole('button', { name: 'Open' }));

      const rate = within(within(drawer()).getByRole('group', { name: 'Developer' })).getByLabelText('Rate per hour');
      await waitFor(() => expect(rate).toHaveFocus());
      expect(rate).toHaveAttribute('aria-invalid', 'true');

      await user.click(within(drawer()).getByRole('button', { name: 'Done' }));
      expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
    });

    it('goes past the fields that are fine, to the one that is wrong', async () => {
      const user = userEvent.setup();
      render(<Harness wrong={{ hoursPerMonth: '9999' }} open={false} />);
      await waitFor(() => expect(screen.getByTestId('wrong')).toHaveTextContent('hoursPerMonth'));
      await user.click(screen.getByRole('button', { name: 'Open' }));
      await waitFor(() => expect(within(drawer()).getByLabelText('Hours in a month')).toHaveFocus());
    });

    it('leaves focus on the first field as before when nothing is wrong', async () => {
      const user = userEvent.setup();
      render(<Harness open={false} />);
      await user.click(screen.getByRole('button', { name: 'Open' }));
      const developer = within(within(drawer()).getByRole('group', { name: 'Developer' }));
      await waitFor(() => expect(developer.getByLabelText('People')).toHaveFocus());
      await user.click(within(drawer()).getByRole('button', { name: 'Done' }));
      expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
    });
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
