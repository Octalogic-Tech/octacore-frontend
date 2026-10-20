import { useState } from 'react';
import { useFieldArray, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { LuTrash2 } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { fieldA11y } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { bufferedHours, formatHours } from './calc';
import { LINE_COLUMNS, NONE, QuoteLineRow } from './quote-line-row';
import { MAX_LINES, blankQuoteLine, lineHours, type QuoteFormValues, type SectionFormValues } from './schema';

interface QuoteSectionProps {
  control: Control<QuoteFormValues>;
  register: UseFormRegister<QuoteFormValues>;
  errors: FieldErrors<QuoteFormValues>;
  index: number;
  section: SectionFormValues | undefined;
  /** The number, in the whole quote, of this section's first line. */
  firstLineNumber: number;
  /** How many lines the whole quote has. */
  lineCount: number;
  sectionCount: number;
  /** The time buffer in hundredths of a percent, or null while the settings are invalid. */
  bufferBp: number | null;
  onRemove: () => void;
  /** Where focus goes when the section is removed after asking. */
  fallbackFocusId: string;
}

/** Hundredths of an hour with the noun: `1 hour`, `2.5 hours`. */
const hoursText = (hundredths: number) => `${formatHours(hundredths)} ${hundredths === 100 ? 'hour' : 'hours'}`;

const hasText = (text: string) => text.trim() !== '';

/** A titled group of lines with its own hours, its compact table of lines and its own Add line. */
export function QuoteSection({
  control,
  register,
  errors,
  index,
  section,
  firstLineNumber,
  lineCount,
  sectionCount,
  bufferBp,
  onRemove,
  fallbackFocusId,
}: QuoteSectionProps) {
  const number = index + 1;
  const { fields, append, remove } = useFieldArray({ control, name: `sections.${index}.lines` });
  const [asking, setAsking] = useState(false);

  const lines = section?.lines ?? [];
  // The section's own sums, over its valid lines: the same figures the rows show, added up.
  const totals = lines.map((line) => lineHours(line)).filter((hours): hours is number => hours !== null);
  const hours = totals.reduce((sum, value) => sum + value, 0);
  const buffered =
    bufferBp === null ? null : totals.reduce((sum, value) => sum + bufferedHours(value, bufferBp), 0);
  // Anything typed in a line is worth a question before it goes; the units start at 1, so they do not count.
  const holdsWork = lines.some((line) => hasText(line.title) || hasText(line.description) || hasText(line.hoursPerUnit));

  const sectionErrors = errors.sections?.[index];
  const titleError = sectionErrors?.title?.message;
  const linesMessage = sectionErrors?.lines?.root?.message ?? sectionErrors?.lines?.message;
  const titleId = `section-${number}-title`;

  return (
    <div role="group" aria-label={`Section ${number}`} className="grid gap-2">
      <div className="grid items-start gap-x-4 gap-y-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-center">
        <div className="grid gap-1">
          <Input
            {...fieldA11y(titleId, titleError)}
            {...register(`sections.${index}.title`)}
            aria-label={`Section ${number} title`}
            placeholder="Section title"
            autoComplete="off"
            className="font-semibold"
          />
          {titleError ? (
            <p id={`${titleId}-error`} role="alert" className="text-small text-foreground">
              {titleError}
            </p>
          ) : null}
        </div>
        <p className="tabular flex flex-wrap gap-x-3 text-small text-navy-80">
          <span>{hoursText(hours)}</span>
          <span>{`${buffered === null ? NONE : formatHours(buffered)} with buffer`}</span>
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="quiet"
            disabled={lineCount >= MAX_LINES}
            onClick={() =>
              append({ ...blankQuoteLine }, { focusName: `sections.${index}.lines.${fields.length}.title` })
            }
          >
            Add line
          </Button>
          <IconButton
            label={`Remove section ${number}`}
            icon={LuTrash2}
            disabled={sectionCount === 1}
            onClick={() => (holdsWork ? setAsking(true) : onRemove())}
          />
        </div>
      </div>

      {fields.length > 0 ? (
        <div>
          {/* Column names for the sighted; the inputs carry their own. Below `md` each line stacks and labels itself. */}
          <div
            aria-hidden="true"
            className={cn(
              'hidden gap-x-2 border-b border-rule pb-1 text-[0.75rem] font-semibold text-navy-80 md:grid',
              LINE_COLUMNS,
            )}
          >
            <span>Title</span>
            <span className="text-right">Units</span>
            <span className="text-right">Hours per unit</span>
            <span className="text-right">Total hours</span>
            <span className="text-right">Hours with buffer</span>
            <span />
            <span />
          </div>
          {fields.map((field, lineIndex) => {
            const lineErrors = sectionErrors?.lines?.[lineIndex];
            return (
              <QuoteLineRow
                key={field.id}
                control={control}
                register={register}
                sectionIndex={index}
                lineIndex={lineIndex}
                number={firstLineNumber + lineIndex}
                line={lines[lineIndex]}
                bufferBp={bufferBp}
                messages={{
                  title: lineErrors?.title?.message,
                  units: lineErrors?.units?.message,
                  hoursPerUnit: lineErrors?.hoursPerUnit?.message,
                }}
                canRemove={lineCount > 1}
                onRemove={() => remove(lineIndex)}
              />
            );
          })}
        </div>
      ) : (
        <p className="text-small text-navy-72">No lines in this section yet.</p>
      )}

      {linesMessage ? (
        <p role="alert" className="text-small text-foreground">
          {linesMessage}
        </p>
      ) : null}

      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={`Remove section ${number}?`}
        description="Its lines are removed with it."
        confirmLabel="Remove section"
        onConfirm={async () => onRemove()}
        fallbackFocusId={fallbackFocusId}
      />
    </div>
  );
}
