import { useState } from 'react';
import type { Control, UseFormRegister } from 'react-hook-form';
import { LuFileText, LuGripVertical, LuTrash2 } from 'react-icons/lu';
import { fieldA11y } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { SortableItem, SortableItemHandle } from '@/components/ui/sortable';
import { cn } from '@/lib/utils';
import { bufferedHours, formatHours } from './calc';
import { LineDescriptionDialog } from './line-description-dialog';
import { lineHours, type LineFormValues, type QuoteFormValues } from './schema';

export const NONE = '—';

/**
 * The compact table's columns from `md` up: the drag handle, then the title takes the free width; units, hours per unit,
 * total hours, hours with buffer and the two icon buttons have fixed ones. Shared by the headings and every row, so they
 * line up.
 */
export const LINE_COLUMNS = 'md:grid-cols-[2rem_minmax(0,1fr)_5rem_6.5rem_5.5rem_7rem_2rem_2rem]';

/**
 * The line table's smaller type from `md` up. The owner asked for smaller fields and fonts to see more lines at once: an
 * exception to the 44px targets for this table only. Below `md` the stacked line keeps the usual sizes.
 */
export const COMPACT_TEXT = 'md:text-[0.8125rem]';
const compactInput = `md:h-8 md:min-h-0 md:pt-0 ${COMPACT_TEXT}`;
const compactButton = 'md:size-8';

export type LineField = 'title' | 'units' | 'hoursPerUnit';
const FIELDS: readonly LineField[] = ['title', 'units', 'hoursPerUnit'];
const LINE_NAMES = { title: 'title', units: 'units', hoursPerUnit: 'hours per unit' } as const;
const PLACEHOLDERS = { title: 'Title', units: 'Units', hoursPerUnit: 'Hours' } as const;
const LINE_LABELS = { title: 'Title', units: 'Units', hoursPerUnit: 'Hours per unit' } as const;
const INPUT_MODES = { title: undefined, units: 'numeric', hoursPerUnit: 'decimal' } as const;

// Above each field of a stacked line, where the column headings are hidden; from `md` up the headings say it and these go.
const narrowLabel = 'text-small font-semibold text-navy-80 md:hidden';

interface QuoteLineRowProps {
  control: Control<QuoteFormValues>;
  register: UseFormRegister<QuoteFormValues>;
  /** The line's own id, which follows it wherever it is dragged. */
  uid: string;
  sectionIndex: number;
  lineIndex: number;
  /** The line's number in the whole quote, from 1: the names say "Line 3" whichever section it is in. */
  number: number;
  line: LineFormValues | undefined;
  /** The time buffer in hundredths of a percent, or null while the settings are invalid. */
  bufferBp: number | null;
  /** Each field's message, if it has one. */
  messages: Partial<Record<LineField, string>>;
  /** False for the only line in the whole quote. */
  canRemove: boolean;
  onRemove: () => void;
}

/** One line of a section: one compact row from `md`, stacked with small labels below it. */
export function QuoteLineRow({
  control,
  register,
  uid,
  sectionIndex,
  lineIndex,
  number,
  line,
  bufferBp,
  messages,
  canRemove,
  onRemove,
}: QuoteLineRowProps) {
  // Here, not in the editor: a line that is removed takes its open dialog with it.
  const [describing, setDescribing] = useState(false);
  const total = lineHours(line);
  // The panel's hours with the buffer are `totals.bufferedBaseHours`, which pads each valid line the same way.
  const buffered = total === null || bufferBp === null ? null : bufferedHours(total, bufferBp);
  const described = (line?.description ?? '').trim() !== '';

  return (
    // A hairline under each line, so where one ends is plain.
    <SortableItem value={uid} asChild>
      <div role="group" aria-label={`Line ${number}`} className="grid gap-2 border-b border-rule py-4 md:gap-1 md:py-1">
        <div className={cn('grid items-start gap-2 md:items-center md:gap-x-2 md:gap-y-0', LINE_COLUMNS)}>
          {/* Only the handle starts a drag, so the inputs stay editable. A 44px target on a phone, compact from `md`. */}
          <SortableItemHandle asChild>
            <IconButton label={`Drag line ${number}`} icon={LuGripVertical} className={compactButton} />
          </SortableItemHandle>
          {FIELDS.map((name) => (
            <div key={name} className="grid gap-1">
              <span aria-hidden="true" className={narrowLabel}>
                {LINE_LABELS[name]}
              </span>
              <Input
                {...fieldA11y(`line-${number}-${name}`, messages[name])}
                {...register(`sections.${sectionIndex}.lines.${lineIndex}.${name}`)}
                aria-label={`Line ${number} ${LINE_NAMES[name]}`}
                placeholder={PLACEHOLDERS[name]}
                inputMode={INPUT_MODES[name]}
                autoComplete="off"
                className={cn(compactInput, name !== 'title' && 'tabular md:text-right')}
              />
            </div>
          ))}
          <Figure label="Total hours" name={`Line ${number} total hours `} hundredths={total} />
          <Figure label="Hours with buffer" name={`Line ${number} hours with buffer `} hundredths={buffered} />
          {/* Side by side under a stacked line; from `md` each button is a cell of the row. */}
          <div className="flex gap-2 md:contents">
            <span className="relative inline-flex">
              <IconButton
                label={described ? `Edit description of line ${number}` : `Add description to line ${number}`}
                icon={LuFileText}
                onClick={() => setDescribing(true)}
                className={compactButton}
              />
              {/* The line has a description: a small square of teal, framed in navy so it shows on grey. */}
              {described ? (
                <span
                  aria-hidden="true"
                  data-slot="description-marker"
                  className="pointer-events-none absolute right-1 top-1 size-2 border border-foreground bg-teal"
                />
              ) : null}
            </span>
            <IconButton
              label={`Remove line ${number}`}
              icon={LuTrash2}
              disabled={!canRemove}
              onClick={onRemove}
              className={compactButton}
            />
          </div>
        </div>
        {/* Each message has the id its input's aria-describedby points at. The title's is for screen readers only: its
            field's heavier rule says it to the eye, and the row keeps its height. */}
        {FIELDS.map((name) => {
          const message = messages[name];
          return message ? (
            <p
              key={name}
              id={`line-${number}-${name}-error`}
              role="alert"
              className={name === 'title' ? 'sr-only' : 'text-small text-foreground'}
            >
              {message}
            </p>
          ) : null;
        })}
        <LineDescriptionDialog
          open={describing}
          onOpenChange={setDescribing}
          control={control}
          name={`sections.${sectionIndex}.lines.${lineIndex}.description`}
          number={number}
          title={line?.title ?? ''}
        />
      </div>
    </SortableItem>
  );
}

/** A figure worked out from the line, right-aligned in the row, labelled when the line stacks. */
function Figure({ label, name, hundredths }: { label: string; name: string; hundredths: number | null }) {
  return (
    <div className="grid gap-1">
      <span aria-hidden="true" className={narrowLabel}>
        {label}
      </span>
      <p className={cn('tabular py-3 text-small md:py-1 md:text-right', COMPACT_TEXT)}>
        <span className="sr-only">{name}</span>
        {hundredths === null ? NONE : formatHours(hundredths)}
      </p>
    </div>
  );
}
