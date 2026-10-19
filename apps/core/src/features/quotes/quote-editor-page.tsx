import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { LinkArrow } from '@/components/ui/link-arrow';
import { Panel } from '@/components/ui/panel';
import { serviceMessage, statusOf } from '@/lib/core-api';
import { useQuote, useSaveQuote } from './api';
import { formatHours, hundredthsOf, quoteTotals } from './calc';
import { CurrencyInput, QuoteSettingsDrawer } from './quote-settings-drawer';
import { QuoteTotalsPanel } from './quote-totals-panel';
import {
  MAX_LINES,
  SETTINGS_FIELDS,
  blankQuoteLine,
  quoteFormSchema,
  toCalcInput,
  toQuoteBody,
  toQuoteFormValues,
  type QuoteFormValues,
  type QuoteRow,
} from './schema';

const NONE = '—';
const INT32_MAX = 2_147_483_647;
const SETTINGS_BUTTON = 'quote-settings-button';
const COLUMNS = 'sm:grid-cols-[minmax(0,1fr)_5.5rem_7rem_6rem_5.5rem]';
const LINE_FIELDS = ['description', 'units', 'hoursPerUnit'] as const;
const LINE_NAMES = { description: 'description', units: 'units', hoursPerUnit: 'hours per unit' } as const;
const PLACEHOLDERS = { description: 'Description', units: 'Units', hoursPerUnit: 'Hours' } as const;
const INPUT_MODES = { description: undefined, units: 'numeric', hoursPerUnit: 'decimal' } as const;

const backLink =
  'mb-4 inline-flex min-h-11 items-center font-semibold decoration-teal decoration-2 underline-offset-[0.25em] hover:underline focus-visible:underline';

const lineShape = quoteFormSchema.shape.lines.element.shape;

/** A line's units x hours per unit, in hundredths of an hour, or null while either is blank or invalid. */
function lineTotal(line: QuoteFormValues['lines'][number] | undefined): number | null {
  if (line === undefined) return null;
  const units = lineShape.units.safeParse(line.units);
  const hours = lineShape.hoursPerUnit.safeParse(line.hoursPerUnit);
  return units.success && hours.success ? Number(units.data) * hundredthsOf(hours.data) : null;
}

function BackToQuotes() {
  return (
    <Link to="/quotes" className={backLink}>
      Back to quotes
    </Link>
  );
}

function QuoteNotFound() {
  return (
    <>
      <PageHeader title="Quote not found" />
      <Panel>
        <div className="grid justify-items-start gap-2 p-6">
          <p className="text-body">This quote does not exist, or was deleted.</p>
          <LinkArrow to="/quotes">Back to quotes</LinkArrow>
        </div>
      </Panel>
    </>
  );
}

/** `/quotes/new` and `/quotes/:id`: a quotation's lines, its live totals and its settings, saved together. */
export function QuoteEditorPage() {
  const { id } = useParams();
  if (id === undefined) return <QuoteForm key="new" />;
  // Only a plain positive integer the service could hold is worth asking about; anything else is not a quote.
  const quoteId = /^[1-9]\d{0,9}$/.test(id) ? Number(id) : 0;
  if (quoteId < 1 || quoteId > INT32_MAX) return <QuoteNotFound />;
  return <SavedQuote key={quoteId} quoteId={quoteId} />;
}

function SavedQuote({ quoteId }: { quoteId: number }) {
  const quote = useQuote(quoteId);
  // Once the quote is on screen it stays there: a refetch that fails (after a save, say) must not swap the form, and
  // what was typed in it, for an error.
  if (quote.data) return <QuoteForm key={quoteId} quote={quote.data} />;
  if (statusOf(quote.error) === 404) return <QuoteNotFound />;
  return (
    <>
      <BackToQuotes />
      <PageHeader title="Quote" />
      <Panel>
        <QueryBoundary
          isLoading={quote.isLoading}
          isError={quote.isError}
          onRetry={() => void quote.refetch()}
          isEmpty={false}
          empty={null}
        >
          {null}
        </QueryBoundary>
      </Panel>
    </>
  );
}

function QuoteForm({ quote }: { quote?: QuoteRow }) {
  const navigate = useNavigate();
  const save = useSaveQuote();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    // A message once a field is left, then as it is corrected, so a wrong setting is told inside the drawer.
    mode: 'onTouched',
    defaultValues: toQuoteFormValues(quote),
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  // "Saved" holds until the next edit.
  useEffect(() => {
    const subscription = watch(() => setSaved(false));
    return () => subscription.unsubscribe();
  }, [watch]);

  const values = watch();
  const calc = toCalcInput(values);
  // Never asked for while a setting is invalid: the mirror throws on a zero count, day or month.
  const totals = calc.settings ? quoteTotals(calc.settings, calc.lines) : null;
  const lineHours = calc.lines.reduce((sum, line) => sum + line.units * line.hoursHundredths, 0);
  const settingsWrong = calc.settings === null || SETTINGS_FIELDS.some((name) => errors[name] !== undefined);
  const linesMessage = errors.lines?.root?.message ?? errors.lines?.message;

  const submit = handleSubmit(
    async (valid) => {
      setFailure(null);
      setSaved(false);
      try {
        const id = await save.mutateAsync({ id: quote?.id, body: toQuoteBody(valid) });
        if (quote === undefined) {
          // A new quote moves to its own address; if the answer did not say where that is, to the list it is on.
          navigate(id === undefined ? '/quotes' : `/quotes/${id}`, { replace: true });
          return;
        }
        reset(valid);
        setSaved(true);
      } catch (error) {
        const status = statusOf(error);
        if (quote !== undefined && status === 404) {
          setFailure('This quote was deleted elsewhere, so it cannot be saved. Go back to the quotes.');
        } else {
          setFailure((status === 422 ? serviceMessage(error) : undefined) ?? 'Could not save. Try again.');
        }
      }
    },
    (invalid) => {
      // A message inside the closed drawer would be out of sight.
      if (SETTINGS_FIELDS.some((name) => invalid[name] !== undefined)) setSettingsOpen(true);
    },
  );

  return (
    <>
      <BackToQuotes />
      <PageHeader title={quote?.title ?? 'New quote'}>
        <Button id={SETTINGS_BUTTON} variant="quiet" onClick={() => setSettingsOpen(true)}>
          {settingsWrong ? 'Settings (check)' : 'Settings'}
        </Button>
        <Button type="submit" form="quote-form" disabled={isSubmitting}>
          Save
        </Button>
      </PageHeader>

      <form id="quote-form" onSubmit={submit} noValidate className="grid gap-8">
        {saved ? (
          <p role="status" className="text-small font-semibold text-foreground">
            Saved
          </p>
        ) : null}
        {failure ? (
          <p role="alert" className="text-small font-semibold text-foreground">
            {failure}
          </p>
        ) : null}

        {/* The totals sit under the lines on a narrow screen and beside them from `lg`. */}
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid gap-6">
            <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <Field label="Title" htmlFor="quote-title" error={errors.title?.message}>
                <Input {...fieldA11y('quote-title', errors.title?.message)} {...register('title')} autoComplete="off" />
              </Field>
              <CurrencyInput
                control={control}
                id="quote-currency"
                label="Currency"
                error={errors.currencyCode?.message}
              />
            </div>

            <div className="grid gap-3">
              <h2 className="text-small font-semibold text-navy-80">Lines</h2>
              {/* Column names for the sighted; the inputs carry their own names, and below `sm` each row stacks. */}
              <div aria-hidden="true" className={`hidden gap-2 text-small font-semibold text-navy-80 sm:grid ${COLUMNS}`}>
                <span>Description</span>
                <span>Units</span>
                <span>Hours per unit</span>
                <span className="text-right">Total hours</span>
                <span />
              </div>

              {fields.map((field, index) => {
                const number = index + 1;
                const rowErrors = errors.lines?.[index];
                const total = lineTotal(values.lines[index]);
                return (
                  <div key={field.id} role="group" aria-label={`Line ${number}`} className="grid gap-1">
                    <div className={`grid items-start gap-2 ${COLUMNS}`}>
                      {LINE_FIELDS.map((name) => (
                        <Input
                          key={name}
                          {...fieldA11y(`line-${number}-${name}`, rowErrors?.[name]?.message)}
                          {...register(`lines.${index}.${name}`)}
                          aria-label={`Line ${number} ${LINE_NAMES[name]}`}
                          placeholder={PLACEHOLDERS[name]}
                          inputMode={INPUT_MODES[name]}
                          autoComplete="off"
                        />
                      ))}
                      <p className="tabular py-3 text-right text-small">
                        <span className="sr-only">{`Line ${number} total hours `}</span>
                        {total === null ? NONE : formatHours(total)}
                      </p>
                      <Button
                        variant="quiet"
                        aria-label={`Remove line ${number}`}
                        disabled={fields.length === 1}
                        onClick={() => remove(index)}
                      >
                        Remove
                      </Button>
                    </div>
                    {/* Every message the row has, each with the id its input's aria-describedby points at. */}
                    {LINE_FIELDS.map((name) => {
                      const message = rowErrors?.[name]?.message;
                      return message ? (
                        <p key={name} id={`line-${number}-${name}-error`} role="alert" className="text-small text-foreground">
                          {message}
                        </p>
                      ) : null;
                    })}
                  </div>
                );
              })}

              {linesMessage ? (
                <p role="alert" className="text-small text-foreground">
                  {linesMessage}
                </p>
              ) : null}

              <div>
                <Button
                  variant="quiet"
                  disabled={fields.length >= MAX_LINES}
                  onClick={() => append({ ...blankQuoteLine })}
                >
                  Add line
                </Button>
              </div>
            </div>
          </div>

          <QuoteTotalsPanel
            settings={calc.settings}
            totals={totals}
            lineHours={lineHours}
            currencyCode={values.currencyCode.trim().toUpperCase()}
          />
        </div>
      </form>

      <QuoteSettingsDrawer
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        register={register}
        control={control}
        errors={errors}
        currencyCode={values.currencyCode}
        fallbackFocusId={SETTINGS_BUTTON}
      />
    </>
  );
}
