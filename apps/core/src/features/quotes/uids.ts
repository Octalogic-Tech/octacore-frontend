import {
  blankQuoteLine,
  type LineFormValues,
  type QuoteFormValues,
  type SectionFormValues,
} from './schema';

/**
 * Every section and line in the editor carries a `uid` of its own, made here and never sent. It is the React key of its
 * row and its id in the drag and drop, so a row that is dragged, or that another row moves past, keeps its inputs (and
 * what is typed in them) instead of being made again. A position, or react-hook-form's own field ids, cannot do that: a
 * line dragged to another section leaves one field array for another.
 */
let last = 0;

/** A new uid: `section-…` and `line-…` never meet, so a section's id can never be a line's. */
export function nextUid(kind: 'section' | 'line'): string {
  last += 1;
  return `${kind}-${last}`;
}

export function newLine(): LineFormValues {
  return { ...blankQuoteLine, uid: nextUid('line') };
}

/** A section with an empty title and one blank line, or none when the quote has no room for another line. */
export function newSection(withLine: boolean): SectionFormValues {
  return { uid: nextUid('section'), title: '', lines: withLine ? [newLine()] : [] };
}

/** The form's values with a uid on every section and line that has none. */
export function withUids(values: QuoteFormValues): QuoteFormValues {
  return {
    ...values,
    sections: values.sections.map((section) => ({
      ...section,
      uid: section.uid ?? nextUid('section'),
      lines: section.lines.map((line) => ({ ...line, uid: line.uid ?? nextUid('line') })),
    })),
  };
}
