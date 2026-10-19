import { allocationRows } from '@/test/fixtures/allocations';
import {
  allocationFormSchema,
  allocationMatches,
  allocationRowsSchema,
  toAllocationBody,
  toAllocationFormValues,
  type AllocationFormValues,
} from './schema';

// A fixed "today", so a new entry's default date can be checked against an exact day.
vi.mock('@/lib/format', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/format')>()),
  localToday: () => '2026-10-20',
}));

const [graceToBench, adaOnWebsite, , adaOnBench] = allocationRowsSchema.parse(allocationRows);

const form = (over: Partial<AllocationFormValues> = {}): AllocationFormValues => ({
  personId: '1',
  projectId: 'bench',
  effectiveDate: '2026-10-20',
  note: '',
  ...over,
});

const messages = (values: AllocationFormValues) => {
  const result = allocationFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('allocationRowSchema', () => {
  it('keeps the entry with its person and its project', () => {
    expect(adaOnWebsite).toEqual({
      id: 3,
      personId: 1,
      projectId: 1,
      effectiveDate: '2026-03-12',
      note: '',
      person: { id: 1, name: 'Ada Lovelace' },
      project: { id: 1, name: 'Website' },
    });
    expect(adaOnWebsite).not.toHaveProperty('status');
    expect(adaOnWebsite).not.toHaveProperty('createdDate');
  });

  it('reads a null project as the bench, and keeps a note that was written', () => {
    expect(graceToBench).toMatchObject({ projectId: null, project: null, note: 'Between projects' });
    expect(adaOnBench).toMatchObject({ projectId: null, project: null });
  });

  it('turns a null note into empty text', () => {
    expect(adaOnWebsite.note).toBe('');
  });

  it.each([
    ['an id', { ...allocationRows[1], id: undefined }],
    ['the person', { ...allocationRows[1], person: undefined }],
    ['the project field, which is null for the bench and never absent', { ...allocationRows[1], project: undefined }],
    ['a project id that is not a whole number', { ...allocationRows[1], projectId: '1' }],
    ['a date that is not a calendar day', { ...allocationRows[1], effectiveDate: '12/03/2026' }],
    ['a date that is not a real day', { ...allocationRows[1], effectiveDate: '2026-02-31' }],
    ['no date', { ...allocationRows[1], effectiveDate: undefined }],
  ])('rejects an entry with %s', (_label, row) => {
    expect(allocationRowsSchema.safeParse([row]).success).toBe(false);
  });
});

describe('allocationFormSchema', () => {
  it('accepts an entry that puts a person on a project, or on the bench', () => {
    expect(messages(form({ projectId: '2' }))).toEqual([]);
    expect(messages(form({ projectId: 'bench' }))).toEqual([]);
  });

  it('needs a person', () => {
    expect(messages(form({ personId: '' }))).toEqual(['Choose a person']);
  });

  it('needs a date', () => {
    expect(messages(form({ effectiveDate: '' }))).toEqual(['Effective date is required']);
  });

  it.each(['', 'Bench', 'none', '2.5', '-1', '0'])('refuses %j as a project', (projectId) => {
    expect(messages(form({ projectId }))).toEqual(['Choose a project or the bench']);
  });

  it('accepts a note, or none', () => {
    expect(messages(form({ note: 'Covering a sick day' }))).toEqual([]);
    expect(messages(form({ note: '' }))).toEqual([]);
  });
});

describe('toAllocationFormValues', () => {
  it('opens a new entry on the bench option, dated today, with nobody chosen', () => {
    expect(toAllocationFormValues()).toEqual({ personId: '', projectId: 'bench', effectiveDate: '2026-10-20', note: '' });
  });

  it('writes an entry as text: the project as its id, the bench as "bench"', () => {
    expect(toAllocationFormValues(adaOnWebsite)).toEqual({
      personId: '1',
      projectId: '1',
      effectiveDate: '2026-03-12',
      note: '',
    });
    expect(toAllocationFormValues(graceToBench)).toEqual({
      personId: '2',
      projectId: 'bench',
      effectiveDate: '2026-08-03',
      note: 'Between projects',
    });
  });
});

describe('toAllocationBody', () => {
  it('sends the bench as a null project, and a project as its id', () => {
    expect(toAllocationBody(form({ projectId: 'bench' })).projectId).toBeNull();
    expect(toAllocationBody(form({ projectId: '12' })).projectId).toBe(12);
  });

  it('sends the person as a number, the date as typed, and an empty note as null', () => {
    expect(toAllocationBody(form({ personId: '7', effectiveDate: '2026-02-03' }))).toEqual({
      personId: 7,
      projectId: null,
      effectiveDate: '2026-02-03',
      note: null,
    });
  });

  it('sends a note that was written', () => {
    expect(toAllocationBody(form({ note: 'Covering a sick day' })).note).toBe('Covering a sick day');
  });

  it.each([adaOnWebsite, graceToBench, adaOnBench])(
    'sends entry $id back as it was, so saving it unchanged cannot move it',
    (row) => {
      const values = toAllocationFormValues(row);
      expect(messages(values)).toEqual([]);
      expect(toAllocationBody(values)).toEqual({
        personId: row.personId,
        projectId: row.projectId,
        effectiveDate: row.effectiveDate,
        note: row.note === '' ? null : row.note,
      });
    },
  );
});

describe('allocationMatches', () => {
  it('finds an entry by the person, whatever the case', () => {
    expect(allocationMatches(adaOnWebsite, 'ada')).toBe(true);
    expect(allocationMatches(adaOnWebsite, 'LOVELACE')).toBe(true);
    expect(allocationMatches(adaOnWebsite, 'grace')).toBe(false);
  });

  it('finds an entry by the project, or by Bench when it is on the bench', () => {
    expect(allocationMatches(adaOnWebsite, 'web')).toBe(true);
    expect(allocationMatches(adaOnWebsite, 'bench')).toBe(false);
    expect(allocationMatches(adaOnBench, 'bench')).toBe(true);
    expect(allocationMatches(adaOnBench, 'web')).toBe(false);
  });

  it('matches everything for a blank query, and nothing for text that is nowhere on the entry', () => {
    expect(allocationMatches(adaOnWebsite, '')).toBe(true);
    expect(allocationMatches(adaOnBench, '   ')).toBe(true);
    expect(allocationMatches(adaOnWebsite, 'zzz')).toBe(false);
  });

  it('does not search the note or the date', () => {
    expect(allocationMatches(graceToBench, 'between')).toBe(false);
    expect(allocationMatches(adaOnWebsite, '2026')).toBe(false);
  });
});
