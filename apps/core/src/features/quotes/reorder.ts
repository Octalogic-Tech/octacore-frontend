/**
 * The quote's sections and lines put in a new order, as plain data: what a drag does to the form, worked out apart from
 * React and the form so it can be tested on its own. Every function returns new arrays and never changes its input; a
 * move that changes nothing returns the very array it was given, so a caller can tell.
 */

/** Where a line is: its section's position and its own position in that section, both from 0. */
export interface LineSpot {
  section: number;
  index: number;
}

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);
const within = (value: number, length: number) => Number.isInteger(value) && value >= 0 && value < length;

/** The sections with the one at `from` moved to `to` (its final position, kept inside the list). */
export function moveSection<S>(sections: readonly S[], from: number, to: number): S[] {
  if (!within(from, sections.length)) return sections as S[];
  const target = clamp(to, 0, sections.length - 1);
  if (target === from) return sections as S[];
  const next = [...sections];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}

/**
 * The sections with one line moved: out of `from`, into `to.section` at `to.index`, its final position there (kept
 * between the start and the end of that section, so an index past the end is the end). The two sections it touches are
 * new objects with new line arrays; every other section is the same object.
 */
export function moveLine<S extends { lines: readonly unknown[] }>(sections: readonly S[], from: LineSpot, to: LineSpot): S[] {
  const source = sections[from.section];
  if (!within(from.section, sections.length) || !within(to.section, sections.length) || !source) return sections as S[];
  if (!within(from.index, source.lines.length)) return sections as S[];

  const lines = [...source.lines];
  const [moved] = lines.splice(from.index, 1);
  if (from.section === to.section) {
    const target = clamp(to.index, 0, lines.length);
    if (target === from.index) return sections as S[];
    lines.splice(target, 0, moved);
    return sections.map((section, index) => (index === from.section ? { ...section, lines } : section));
  }

  const destination = [...sections[to.section].lines];
  destination.splice(clamp(to.index, 0, destination.length), 0, moved);
  return sections.map((section, index) => {
    if (index === from.section) return { ...section, lines };
    if (index === to.section) return { ...section, lines: destination };
    return section;
  });
}
