export interface Option {
  id: number;
  label: string;
}

/**
 * The list plus the record's own choice when the list lacks it, so an edit cannot blank a select whose list is still
 * loading, has failed, or no longer holds that choice.
 */
export function withCurrent(options: Option[], current: Option | undefined): Option[] {
  return current && !options.some((option) => option.id === current.id) ? [...options, current] : options;
}
