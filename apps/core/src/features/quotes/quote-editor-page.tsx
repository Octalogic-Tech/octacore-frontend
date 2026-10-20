import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useFullWidthPage } from '@/app/page-width';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { LinkArrow } from '@/components/ui/link-arrow';
import { Panel } from '@/components/ui/panel';
import { serviceMessage, statusOf } from '@/lib/core-api';
import { useQuote, useSaveQuote } from './api';
import { quoteTotals } from './calc';
import { QuoteSection } from './quote-section';
import { CurrencyInput, QuoteSettingsDrawer } from './quote-settings-drawer';
import { QuoteTotalsPanel } from './quote-totals-panel';
import {
  MAX_SECTIONS,
  SETTINGS_FIELDS,
  blankQuoteLine,
  lineCount,
  quoteFormSchema,
  toCalcInput,
  toQuoteBody,
  toQuoteFormValues,
  type QuoteFormValues,
  type QuoteRow,
} from './schema';

const INT32_MAX = 2_147_483_647;
const SETTINGS_BUTTON = 'quote-settings-button';
const ADD_SECTION_BUTTON = 'quote-add-section';

const backLink =
  'mb-4 inline-flex min-h-11 items-center font-semibold decoration-teal decoration-2 underline-offset-[0.25em] hover:underline focus-visible:underline';

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

/** `/quotes/new` and `/quotes/:id`: a quotation's sections of lines, its live totals and its settings, saved together. */
export function QuoteEditorPage() {
  // The lines need the room: the editor, loading and not found alike, drops the shell's 75rem cap.
  useFullWidthPage();
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
  const location = useLocation();
  const save = useSaveQuote();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // A new quote's first save ends in this page being opened for it, and the form that was saved is gone: the navigation
  // carries the news, so the page says "Saved" like it does after any later save.
  const arrivedSaved = quote !== undefined && (location.state as { saved?: boolean } | null)?.saved === true;
  const [saved, setSaved] = useState(arrivedSaved);
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    // A message once a field is left, then as it is corrected, so a wrong setting is told inside the drawer.
    mode: 'onTouched',
    defaultValues: toQuoteFormValues(quote),
  });
  const sectionFields = useFieldArray({ control, name: 'sections' });

  // "Saved" holds until the next edit. The edits are counted too, so a save answered after more were made can tell.
  const edits = useRef(0);
  useEffect(() => {
    const subscription = watch(() => {
      edits.current += 1;
      setSaved(false);
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  // The news is for this arrival alone: taken out of the history entry, a reload or a Back does not repeat it.
  useEffect(() => {
    if (arrivedSaved) navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
  }, [arrivedSaved, location.pathname, location.search, navigate]);

  const values = watch();
  const calc = toCalcInput(values);
  // Never asked for while a setting is invalid: the mirror throws on a zero count, day or month.
  const totals = calc.settings ? quoteTotals(calc.settings, calc.lines) : null;
  const lineHours = calc.lines.reduce((sum, line) => sum + line.units * line.hoursHundredths, 0);
  // Null while the settings, the time buffer among them, are invalid: then no line or section shows hours with the buffer.
  const bufferBp = calc.settings?.timeBufferBp ?? null;
  const settingsWrong = calc.settings === null || SETTINGS_FIELDS.some((name) => errors[name] !== undefined);
  // The quote's own messages (a line in all, at most 200, too large) go under the sections.
  const sectionsMessage = errors.sections?.root?.message ?? errors.sections?.message;
  const lines = lineCount(values);
  // Lines are numbered across the whole quote: each section starts after the lines of those before it.
  const firstLineNumbers: number[] = [];
  values.sections.reduce((next, section) => {
    firstLineNumbers.push(next);
    return next + section.lines.length;
  }, 1);

  function removeSection(index: number) {
    sectionFields.remove(index);
    // The button that was pressed goes with its section: focus moves to the next thing to do.
    document.getElementById(ADD_SECTION_BUTTON)?.focus();
  }

  const submit = handleSubmit(
    async (valid) => {
      setFailure(null);
      setSaved(false);
      const editsAtSend = edits.current;
      try {
        const id = await save.mutateAsync({ id: quote?.id, body: toQuoteBody(valid) });
        if (quote === undefined) {
          // A new quote moves to its own address (which says "Saved" there); if the answer did not say where that is, to
          // the list it is on.
          if (id === undefined) navigate('/quotes', { replace: true });
          else navigate(`/quotes/${id}`, { replace: true, state: { saved: true } });
          return;
        }
        // Whatever was typed, added or removed while the save was out stays: the form is made clean against what was
        // saved, not set back to it.
        const unchangedSince = edits.current === editsAtSend;
        const code = valid.currencyCode.toUpperCase();
        reset({ ...valid, currencyCode: code }, { keepValues: true, keepErrors: true });
        // The code is kept in capitals, so show it so, unless it was changed meanwhile.
        const typed = getValues('currencyCode');
        if (typed !== code && typed.trim() === valid.currencyCode) setValue('currencyCode', code);
        setSaved(unchangedSince);
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

        {/* The totals sit under the sections, and beside them, in sight as the lines scroll, only from `2xl`. */}
        <div className="grid items-start gap-8 2xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid min-w-0 gap-6">
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
              <div className="grid gap-8">
                {sectionFields.fields.map((field, index) => (
                  <QuoteSection
                    key={field.id}
                    control={control}
                    register={register}
                    errors={errors}
                    index={index}
                    section={values.sections[index]}
                    firstLineNumber={firstLineNumbers[index] ?? 1}
                    lineCount={lines}
                    sectionCount={sectionFields.fields.length}
                    bufferBp={bufferBp}
                    onRemove={() => removeSection(index)}
                    fallbackFocusId={ADD_SECTION_BUTTON}
                  />
                ))}
              </div>

              {sectionsMessage ? (
                <p role="alert" className="text-small text-foreground">
                  {sectionsMessage}
                </p>
              ) : null}

              <div>
                <Button
                  id={ADD_SECTION_BUTTON}
                  variant="quiet"
                  disabled={sectionFields.fields.length >= MAX_SECTIONS}
                  onClick={() =>
                    sectionFields.append(
                      { title: '', lines: [{ ...blankQuoteLine }] },
                      { focusName: `sections.${sectionFields.fields.length}.title` },
                    )
                  }
                >
                  Add section
                </Button>
              </div>
            </div>
          </div>

          <aside aria-label="Quote totals" className="2xl:sticky 2xl:top-6 2xl:self-start">
            <QuoteTotalsPanel
              settings={calc.settings}
              totals={totals}
              lineHours={lineHours}
              currencyCode={values.currencyCode.trim().toUpperCase()}
            />
          </aside>
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
