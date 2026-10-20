import type { FieldError, FieldErrors } from 'react-hook-form';
import type { QuoteFormValues } from './schema';

const LINE_FIELDS = ['title', 'units', 'hoursPerUnit'] as const;

type SectionsErrors = FieldErrors<QuoteFormValues>['sections'];

/** One wrong field of a section or a line: where it is, which field, and its error. */
export interface WrongField {
  section: number;
  /** Absent for the section's own title. */
  line?: number;
  field: 'title' | (typeof LINE_FIELDS)[number];
  error: FieldError;
}

/** Every wrong field of the sections and their lines, in the order the page shows them. */
export function wrongFields(errors: SectionsErrors, sections: QuoteFormValues['sections']): WrongField[] {
  const wrong: WrongField[] = [];
  sections.forEach((section, sectionIndex) => {
    const sectionErrors = errors?.[sectionIndex];
    if (sectionErrors?.title) wrong.push({ section: sectionIndex, field: 'title', error: sectionErrors.title });
    section.lines.forEach((_line, lineIndex) => {
      const lineErrors = sectionErrors?.lines?.[lineIndex];
      for (const field of LINE_FIELDS) {
        const error = lineErrors?.[field];
        if (error) wrong.push({ section: sectionIndex, line: lineIndex, field, error });
      }
    });
  });
  return wrong;
}

export const pathOf = (wrong: Pick<WrongField, 'section' | 'line' | 'field'>) =>
  wrong.line === undefined
    ? (`sections.${wrong.section}.title` as const)
    : (`sections.${wrong.section}.lines.${wrong.line}.${wrong.field}` as const);

/**
 * The field a failed Save should put focus on: the first wrong one in the order the page shows them (the quote's title,
 * then each section's title and its lines' fields). react-hook-form's own choice follows the order the fields were
 * first registered in, which a line added to an earlier section, or a drag, leaves out of step with the page.
 */
export function firstWrongField(errors: FieldErrors<QuoteFormValues>, values: QuoteFormValues) {
  if (errors.title) return 'title' as const;
  const [first] = wrongFields(errors.sections, values.sections);
  return first ? pathOf(first) : null;
}
