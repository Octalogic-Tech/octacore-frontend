import { moveLine, moveSection } from './reorder';

interface Section {
  name: string;
  lines: string[];
}

const quote = (): Section[] => [
  { name: 'A', lines: ['a1', 'a2', 'a3'] },
  { name: 'B', lines: ['b1'] },
  { name: 'C', lines: [] },
];

const shape = (sections: Section[]) => sections.map((section) => `${section.name}:${section.lines.join(',')}`);
const allLines = (sections: Section[]) => sections.flatMap((section) => section.lines);

describe('moveSection', () => {
  it('moves a section down and up, keeping each section whole', () => {
    expect(shape(moveSection(quote(), 0, 2))).toEqual(['B:b1', 'C:', 'A:a1,a2,a3']);
    expect(shape(moveSection(quote(), 2, 0))).toEqual(['C:', 'A:a1,a2,a3', 'B:b1']);
    expect(shape(moveSection(quote(), 0, 1))).toEqual(['B:b1', 'A:a1,a2,a3', 'C:']);
  });

  it('returns a new array and leaves the one it was given as it was', () => {
    const before = quote();
    const after = moveSection(before, 0, 1);
    expect(after).not.toBe(before);
    expect(shape(before)).toEqual(['A:a1,a2,a3', 'B:b1', 'C:']);
    // The sections themselves are the same objects: only their order changes.
    expect(after[1]).toBe(before[0]);
  });

  it('is a no-op, the same array back, when the section stays where it is', () => {
    const before = quote();
    expect(moveSection(before, 1, 1)).toBe(before);
  });

  it('clamps the target into the list and ignores a source outside it', () => {
    expect(shape(moveSection(quote(), 0, 99))).toEqual(['B:b1', 'C:', 'A:a1,a2,a3']);
    expect(shape(moveSection(quote(), 2, -5))).toEqual(['C:', 'A:a1,a2,a3', 'B:b1']);
    const before = quote();
    expect(moveSection(before, 7, 0)).toBe(before);
    expect(moveSection(before, -1, 0)).toBe(before);
  });
});

describe('moveLine', () => {
  it('reorders inside a section, to the final position asked for', () => {
    expect(shape(moveLine(quote(), { section: 0, index: 0 }, { section: 0, index: 2 }))).toEqual([
      'A:a2,a3,a1',
      'B:b1',
      'C:',
    ]);
    expect(shape(moveLine(quote(), { section: 0, index: 2 }, { section: 0, index: 0 }))).toEqual([
      'A:a3,a1,a2',
      'B:b1',
      'C:',
    ]);
  });

  it('moves a line to another section, at its start, in its middle or at its end', () => {
    expect(shape(moveLine(quote(), { section: 0, index: 1 }, { section: 1, index: 0 }))).toEqual([
      'A:a1,a3',
      'B:a2,b1',
      'C:',
    ]);
    expect(shape(moveLine(quote(), { section: 0, index: 1 }, { section: 1, index: 1 }))).toEqual([
      'A:a1,a3',
      'B:b1,a2',
      'C:',
    ]);
    expect(shape(moveLine(quote(), { section: 1, index: 0 }, { section: 0, index: 1 }))).toEqual([
      'A:a1,b1,a2,a3',
      'B:',
      'C:',
    ]);
  });

  it('moves a line into an empty section', () => {
    expect(shape(moveLine(quote(), { section: 0, index: 0 }, { section: 2, index: 0 }))).toEqual([
      'A:a2,a3',
      'B:b1',
      'C:a1',
    ]);
  });

  it('clamps the target index: past the end is the end, below zero is the start', () => {
    expect(shape(moveLine(quote(), { section: 0, index: 0 }, { section: 1, index: 99 }))).toEqual([
      'A:a2,a3',
      'B:b1,a1',
      'C:',
    ]);
    expect(shape(moveLine(quote(), { section: 0, index: 0 }, { section: 0, index: 99 }))).toEqual([
      'A:a2,a3,a1',
      'B:b1',
      'C:',
    ]);
    expect(shape(moveLine(quote(), { section: 0, index: 2 }, { section: 1, index: -3 }))).toEqual([
      'A:a1,a2',
      'B:a3,b1',
      'C:',
    ]);
  });

  it('keeps every line once: the count is the same and nothing is doubled', () => {
    const before = quote();
    const moves = [
      [{ section: 0, index: 0 }, { section: 2, index: 0 }],
      [{ section: 0, index: 2 }, { section: 1, index: 0 }],
      [{ section: 1, index: 0 }, { section: 0, index: 1 }],
      [{ section: 0, index: 1 }, { section: 0, index: 0 }],
    ] as const;
    for (const [from, to] of moves) {
      const after = moveLine(before, from, to);
      expect(allLines(after)).toHaveLength(allLines(before).length);
      expect(new Set(allLines(after)).size).toBe(allLines(before).length);
      expect([...allLines(after)].sort()).toEqual([...allLines(before)].sort());
    }
  });

  it('leaves the sections it does not touch as the same objects, and the input unchanged', () => {
    const before = quote();
    const after = moveLine(before, { section: 0, index: 0 }, { section: 1, index: 0 });
    expect(after).not.toBe(before);
    expect(after[2]).toBe(before[2]);
    expect(after[0]).not.toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    // Other fields of a section come along.
    expect(after[1].name).toBe('B');
    expect(shape(before)).toEqual(['A:a1,a2,a3', 'B:b1', 'C:']);

    const inside = moveLine(before, { section: 0, index: 0 }, { section: 0, index: 1 });
    expect(inside[1]).toBe(before[1]);
    expect(inside[2]).toBe(before[2]);
  });

  it('is a no-op, the same array back, when the line stays where it is or the source is not there', () => {
    const before = quote();
    expect(moveLine(before, { section: 0, index: 1 }, { section: 0, index: 1 })).toBe(before);
    // Clamped to where it already is.
    expect(moveLine(before, { section: 1, index: 0 }, { section: 1, index: 5 })).toBe(before);
    expect(moveLine(before, { section: 0, index: 3 }, { section: 1, index: 0 })).toBe(before);
    expect(moveLine(before, { section: 2, index: 0 }, { section: 1, index: 0 })).toBe(before);
    expect(moveLine(before, { section: 5, index: 0 }, { section: 1, index: 0 })).toBe(before);
    expect(moveLine(before, { section: 0, index: 0 }, { section: 9, index: 0 })).toBe(before);
  });
});
