import { useState } from 'react';
import { useFieldArray, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { LuGripVertical, LuTrash2 } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { fieldA11y } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { SortableGroup, SortableGroupHandle } from '@/components/ui/sortable';
import { cn } from '@/lib/utils';
import { bufferedHours, formatHours } from './calc';
import { LINE_COLUMNS, NONE, QuoteLineRow } from './quote-line-row';
import { MAX_LINES, lineHours, type LineFormValues, type QuoteFormValues, type SectionFormValues } from './schema';
import { newLine } from './uids';

interface QuoteSectionProps {
  control: Control<QuoteFormValues>;
  register: UseFormRegister<QuoteFormValues>;
  errors: FieldErrors<QuoteFormValues>;
  index: number;
  section: SectionFormValues;
  /** The number, in the whole quote, of this section's first line. */
  firstLineNumber: number;
  /** How many lines the whole quote has. */
  lineCount: number;
  sectionCount: number;
  /** False once the quote has as many sections as it may. */
  canAddSection: boolean;
  /** The time buffer in hundredths of a percent, or null while the settings are invalid. */
  bufferBp: number | null;
  onRemove: () => void;
  /** Puts a new section right after this one. */
  onAddSection: () => void;
  /** Where focus goes when the section is removed after asking. */
  fallbackFocusId: string;
}

/** Hundredths of an hour with the noun: `1 hour`, `2.5 hours`. */
export const hoursText = (hundredths: number) => `${formatHours(hundredths)} ${hundredths === 100 ? 'hour' : 'hours'}`;

/** A section's hours: the sum of its valid lines', as its header shows them. */
export const sectionHours = (lines: readonly LineFormValues[]) =>
  lines.reduce((sum, line) => sum + (lineHours(line) ?? 0), 0);

/** The ids of a section's footer buttons, by the section's number. */
export const addLineId = (number: number) => `section-${number}-add-line`;
export const addSectionId = (number: number) => `section-${number}-add-section`;

const hasText = (text: string) => text.trim() !== '';

/**
 * A titled group of lines: a header (drag handle, title, the section's hours, Remove), its compact table of lines, and a
 * footer row with Add line at the left and Add section at the right.
 */
export function QuoteSection({
  control,
  register,
  errors,
  index,
  section,
  firstLineNumber,
  lineCount,
  sectionCount,
  canAddSection,
  bufferBp,
  onRemove,
  onAddSection,
  fallbackFocusId,
}: QuoteSectionProps) {
  const number = index + 1;
  // Only for adding and removing lines: the rows come from the form's values, keyed by each line's own uid.
  const { append, remove } = useFieldArray({ control, name: `sections.${index}.lines` });
  const [asking, setAsking] = useState(false);

  const lines = section.lines;
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
    <SortableGroup value={section.uid ?? ''} asChild>
      <div role="group" aria-label={`Section ${number}`} className="grid gap-2">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-2 md:grid-cols-[auto_minmax(0,1fr)_auto_auto] md:items-center md:gap-x-4">
          <SortableGroupHandle asChild>
            <IconButton label={`Drag section ${number}`} icon={LuGripVertical} />
          </SortableGroupHandle>
          <div>
            <Input
              {...fieldA11y(titleId, titleError)}
              {...register(`sections.${index}.title`)}
              aria-label={`Section ${number} title`}
              placeholder="Section title"
              autoComplete="off"
              className="font-semibold"
            />
            {/* For screen readers only: the field's heavier rule says it to the eye. */}
            {titleError ? (
              <p id={`${titleId}-error`} role="alert" className="sr-only">
                {titleError}
              </p>
            ) : null}
          </div>
          <p className="tabular col-span-2 flex flex-wrap gap-x-3 text-small text-navy-80 md:col-span-1">
            <span>{hoursText(hours)}</span>
            <span>{`${buffered === null ? NONE : formatHours(buffered)} with buffer`}</span>
          </p>
          <IconButton
            label={`Remove section ${number}`}
            icon={LuTrash2}
            disabled={sectionCount === 1}
            onClick={() => (holdsWork ? setAsking(true) : onRemove())}
          />
        </div>

        {lines.length > 0 ? (
          <div>
            {/* Column names for the sighted; the inputs carry their own. Below `md` each line stacks and labels itself. */}
            <div
              aria-hidden="true"
              className={cn(
                'hidden gap-x-2 border-b border-rule pb-1 text-[0.75rem] font-semibold text-navy-80 md:grid',
                LINE_COLUMNS,
              )}
            >
              <span />
              <span>Title</span>
              <span className="text-right">Units</span>
              <span className="text-right">Hours per unit</span>
              <span className="text-right">Total hours</span>
              <span className="text-right">Hours with buffer</span>
              <span />
              <span />
            </div>
            {lines.map((line, lineIndex) => {
              const lineErrors = sectionErrors?.lines?.[lineIndex];
              return (
                <QuoteLineRow
                  key={line.uid ?? lineIndex}
                  control={control}
                  register={register}
                  uid={line.uid ?? ''}
                  sectionIndex={index}
                  lineIndex={lineIndex}
                  number={firstLineNumber + lineIndex}
                  line={line}
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

        <div className="flex items-center justify-between gap-4">
          <Button
            id={addLineId(number)}
            variant="quiet"
            aria-label={`Add line to section ${number}`}
            disabled={lineCount >= MAX_LINES}
            onClick={() => append(newLine(), { focusName: `sections.${index}.lines.${lines.length}.title` })}
          >
            Add line
          </Button>
          <Button
            id={addSectionId(number)}
            variant="quiet"
            aria-label={`Add section after section ${number}`}
            disabled={!canAddSection}
            onClick={onAddSection}
          >
            Add section
          </Button>
        </div>

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
    </SortableGroup>
  );
}
