import { allocationRows } from '@/test/fixtures/allocations';
import {
  allocationFormSchema,
  allocationMatches,
  allocationRowsSchema,
  cardChoices,
  NEW_CARD,
  REMOVED,
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
  card: '1',
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
      card: 1,
      removed: false,
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

  it('keeps the card the entry belongs to, and whether it says the card is removed', () => {
    const [secondCard, removed] = allocationRowsSchema.parse([
      { ...allocationRows[1], card: 2 },
      { ...allocationRows[1], card: 3, removed: true, projectId: null, project: null },
    ]);
    expect(secondCard).toMatchObject({ card: 2, removed: false, projectId: 1 });
    expect(removed).toMatchObject({ card: 3, removed: true, projectId: null, project: null });
  });

  it.each([
    ['an id', { ...allocationRows[1], id: undefined }],
    ['the person', { ...allocationRows[1], person: undefined }],
    ['the project field, which is null for the bench and never absent', { ...allocationRows[1], project: undefined }],
    ['a project id that is not a whole number', { ...allocationRows[1], projectId: '1' }],
    ['a date that is not a calendar day', { ...allocationRows[1], effectiveDate: '12/03/2026' }],
    ['a date that is not a real day', { ...allocationRows[1], effectiveDate: '2026-02-31' }],
    ['no date', { ...allocationRows[1], effectiveDate: undefined }],
    ['no card', { ...allocationRows[1], card: undefined }],
    ['a card that is not a whole number', { ...allocationRows[1], card: 1.5 }],
    ['card 0', { ...allocationRows[1], card: 0 }],
    ['no removed flag', { ...allocationRows[1], removed: undefined }],
    ['a removed flag that is not a boolean', { ...allocationRows[1], removed: 'yes' }],
  ])('rejects an entry with %s', (_label, row) => {
    expect(allocationRowsSchema.safeParse([row]).success).toBe(false);
  });
});

describe('allocationFormSchema', () => {
  it('accepts an entry that puts a card on a project, on the bench, or says the card is removed', () => {
    expect(messages(form({ projectId: REMOVED }))).toEqual([]);
  });

  it('needs a card: one of the numbers, or a new one', () => {
    expect(messages(form({ card: '' }))).toEqual(['Choose a card']);
    expect(messages(form({ card: 'second' }))).toEqual(['Choose a card']);
    expect(messages(form({ card: '0' }))).toEqual(['Choose a card']);
    expect(messages(form({ card: '3' }))).toEqual([]);
    expect(messages(form({ card: NEW_CARD }))).toEqual([]);
  });

  it('does not let a new card be one that is removed: there is nothing to remove yet', () => {
    expect(messages(form({ card: NEW_CARD, projectId: REMOVED }))).toEqual(['A new card cannot be removed']);
  });

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
  it('opens a new entry on card 1 and the bench option, dated today, with nobody chosen', () => {
    expect(toAllocationFormValues()).toEqual({
      personId: '',
      card: '1',
      projectId: 'bench',
      effectiveDate: '2026-10-20',
      note: '',
    });
  });

  it('writes an entry as text: the project as its id, the bench as "bench"', () => {
    expect(toAllocationFormValues(adaOnWebsite)).toEqual({
      personId: '1',
      card: '1',
      projectId: '1',
      effectiveDate: '2026-03-12',
      note: '',
    });
    expect(toAllocationFormValues(graceToBench)).toEqual({
      personId: '2',
      card: '1',
      projectId: 'bench',
      effectiveDate: '2026-08-03',
      note: 'Between projects',
    });
  });

  it('writes the card of an entry, and a removed entry as the "removed" option', () => {
    const [second, removed] = allocationRowsSchema.parse([
      { ...allocationRows[1], card: 2 },
      { ...allocationRows[1], card: 2, removed: true, projectId: null, project: null },
    ]);
    expect(toAllocationFormValues(second)).toMatchObject({ card: '2', projectId: '1' });
    expect(toAllocationFormValues(removed)).toMatchObject({ card: '2', projectId: 'removed' });
  });
});

describe('toAllocationBody', () => {
  it('sends the bench as a null project, and a project as its id', () => {
    expect(toAllocationBody(form({ projectId: 'bench' })).projectId).toBeNull();
    expect(toAllocationBody(form({ projectId: '12' })).projectId).toBe(12);
  });

  it('sends the person and the card as numbers, the date as typed, and an empty note as null', () => {
    expect(toAllocationBody(form({ personId: '7', card: '2', effectiveDate: '2026-02-03' }))).toEqual({
      personId: 7,
      card: 2,
      projectId: null,
      removed: false,
      effectiveDate: '2026-02-03',
      note: null,
    });
  });

  it('sends a removed card as removed with no project', () => {
    expect(toAllocationBody(form({ projectId: REMOVED }))).toMatchObject({ projectId: null, removed: true });
  });

  it('sends a new card as no number at all, which is for the cards endpoint and not the entries', () => {
    expect(toAllocationBody(form({ card: NEW_CARD })).card).toBeNull();
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
        card: row.card,
        removed: row.removed,
        projectId: row.projectId,
        effectiveDate: row.effectiveDate,
        note: row.note === '' ? null : row.note,
      });
    },
  );
});

describe('cardChoices', () => {
  it('is card 1 for a person with no entries', () => {
    expect(cardChoices([])).toEqual([1]);
  });

  it('lists every card number the person has an entry for, removed cards included, once and in order', () => {
    const rows = allocationRowsSchema.parse([
      { ...allocationRows[1], id: 7, card: 3 },
      { ...allocationRows[1], id: 6, card: 2 },
      { ...allocationRows[1], id: 5, card: 3, removed: true, projectId: null, project: null },
      { ...allocationRows[1], id: 4, card: 1 },
    ]);
    expect(cardChoices(rows)).toEqual([1, 2, 3]);
  });

  it('always offers card 1, even when the entries are all of a later card', () => {
    expect(cardChoices(allocationRowsSchema.parse([{ ...allocationRows[1], card: 2 }]))).toEqual([1, 2]);
  });
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

  it('finds a removed entry by "Card removed", which is what its project column says, and not by Bench', () => {
    const [removed] = allocationRowsSchema.parse([
      { ...allocationRows[1], card: 2, removed: true, projectId: null, project: null },
    ]);
    expect(allocationMatches(removed, 'removed')).toBe(true);
    expect(allocationMatches(removed, 'bench')).toBe(false);
  });

  it('finds an entry by its card, as the ledger writes it', () => {
    const [second] = allocationRowsSchema.parse([{ ...allocationRows[1], card: 2 }]);
    expect(allocationMatches(second, 'card 2')).toBe(true);
    expect(allocationMatches(adaOnWebsite, 'card 2')).toBe(false);
    expect(allocationMatches(adaOnWebsite, 'card 1')).toBe(true);
  });

  it('does not search the note or the date', () => {
    expect(allocationMatches(graceToBench, 'between')).toBe(false);
    expect(allocationMatches(adaOnWebsite, '2026')).toBe(false);
  });
});
