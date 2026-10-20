import { useRef } from 'react';
import type { FieldErrors, UseFormClearErrors, UseFormGetValues, UseFormSetError, UseFormSetValue } from 'react-hook-form';
import { LuGripVertical } from 'react-icons/lu';
import type { SortableAnnouncements, SortableMove, SortablePlace } from '@/components/ui/sortable';
import { pathOf, wrongFields } from './form-errors';
import { hoursText, sectionHours } from './quote-section';
import { NONE } from './quote-line-row';
import { moveLine, moveSection } from './reorder';
import { lineHours, type QuoteFormValues } from './schema';

export const DRAG_INSTRUCTIONS =
  'To move a section or a line, press space on its drag handle, use the up and down arrow keys to move it, then press space again to drop it, or escape to cancel.';

interface QuoteDragOptions {
  sections: QuoteFormValues['sections'];
  /** The number, in the whole quote, of each section's first line. */
  firstLineNumbers: number[];
  errors: FieldErrors<QuoteFormValues>;
  getValues: UseFormGetValues<QuoteFormValues>;
  setValue: UseFormSetValue<QuoteFormValues>;
  setError: UseFormSetError<QuoteFormValues>;
  clearErrors: UseFormClearErrors<QuoteFormValues>;
}

/**
 * The editor's side of the drag and drop: the order the `Sortable` shows, what a move does to the form, what a screen
 * reader is told and what is shown while a section or a line is held.
 *
 * A move is one immutable change to the form's values (`reorder.ts`), set on the field arrays it touches: the sections
 * for a section, the one or two sections' lines for a line. Rows are keyed by their `uid`, so none is made again: a line
 * that stays in its section keeps its input and what is typed in it, and only a line that goes to another section is
 * mounted there anew (from the form's values, so nothing typed is lost). Errors are kept by position, so they are moved
 * with their fields.
 */
export function useQuoteDrag({
  sections,
  firstLineNumbers,
  errors,
  getValues,
  setValue,
  setError,
  clearErrors,
}: QuoteDragOptions) {
  // The section's or the line's number when it was picked up: it is named by that number until it is put down.
  const picked = useRef(0);

  const layout = Object.fromEntries(
    sections.map((section) => [section.uid ?? '', section.lines.map((line) => line.uid ?? '')]),
  );

  function onMove(move: SortableMove) {
    const before = getValues('sections');
    // Where every section and line was, carried through the same move to find where each is now.
    const marks = before.map((section, sectionIndex) => ({
      section: sectionIndex,
      lines: section.lines.map((_line, lineIndex) => ({ section: sectionIndex, line: lineIndex })),
    }));
    let after: typeof before;
    let moved: typeof marks;
    if (move.kind === 'group') {
      after = moveSection(before, move.from, move.to);
      moved = moveSection(marks, move.from, move.to);
      if (after === before) return;
      setValue('sections', after, { shouldDirty: true });
    } else {
      const from = { section: move.from.group, index: move.from.index };
      const to = { section: move.to.group, index: move.to.index };
      after = moveLine(before, from, to);
      moved = moveLine(marks, from, to);
      if (after === before) return;
      for (const section of new Set([from.section, to.section])) {
        setValue(`sections.${section}.lines`, after[section].lines, { shouldDirty: true });
      }
    }

    const wrong = wrongFields(errors.sections, before);
    if (wrong.length === 0) return;
    const now = new Map<string, { section: number; line?: number }>();
    moved.forEach((mark, sectionIndex) => {
      now.set(`${mark.section}`, { section: sectionIndex });
      mark.lines.forEach((line, lineIndex) => now.set(`${line.section}.${line.line}`, { section: sectionIndex, line: lineIndex }));
    });
    clearErrors(before.map((_section, index) => `sections.${index}` as const));
    for (const field of wrong) {
      const at = now.get(field.line === undefined ? `${field.section}` : `${field.section}.${field.line}`);
      if (at) setError(pathOf({ ...at, field: field.field }), { type: field.error.type, message: field.error.message });
    }
  }

  const numberAt = (place: SortablePlace) =>
    place.index === undefined ? place.group + 1 : (firstLineNumbers[place.group] ?? 1) + place.index;
  const where = (place: SortablePlace) => `section ${place.group + 1}, position ${(place.index ?? 0) + 1}`;

  const announcements: SortableAnnouncements = {
    pickedUp: (drag) => {
      picked.current = numberAt(drag.from);
      return `Picked up ${drag.kind === 'group' ? 'section' : 'line'} ${picked.current}`;
    },
    moved: (drag, to) =>
      drag.kind === 'group'
        ? `Moved section ${picked.current} to position ${to.group + 1}`
        : `Moved line ${picked.current} to ${where(to)}`,
    dropped: (drag, to) =>
      drag.kind === 'group'
        ? `Dropped section ${picked.current} at position ${to.group + 1}`
        : `Dropped line ${picked.current} in ${where(to)}`,
    cancelled: (drag) =>
      drag.kind === 'group'
        ? `Cancelled: section ${picked.current} is back at position ${drag.from.group + 1}`
        : `Cancelled: line ${picked.current} is back in ${where(drag.from)}`,
  };

  /** A compact stand-in for what is held: a section's header or a line's row, each its title and its hours. */
  function renderHeld({ value, variant }: { value: string; variant: 'group' | 'item' }) {
    let title = '';
    let hours: number | null = null;
    if (variant === 'group') {
      const section = sections.find((entry) => entry.uid === value);
      title = section?.title.trim() || 'Untitled section';
      hours = sectionHours(section?.lines ?? []);
    } else {
      const line = sections.flatMap((entry) => entry.lines).find((entry) => entry.uid === value);
      title = line?.title.trim() || 'Untitled line';
      hours = lineHours(line);
    }
    return (
      <div
        data-slot="quote-drag-preview"
        className="flex min-h-11 items-center gap-3 border border-foreground bg-background px-3 text-small text-foreground"
      >
        <LuGripVertical aria-hidden="true" focusable="false" className="size-4 flex-none" />
        <span className="min-w-0 flex-1 truncate font-semibold">{title}</span>
        <span className="tabular flex-none">{hours === null ? NONE : hoursText(hours)}</span>
      </div>
    );
  }

  return { layout, onMove, announcements, renderHeld };
}
