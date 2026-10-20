import { allocationRowSchema, type AllocationRow } from '@/features/allocation/schema';
import { projectRowSchema, type ProjectRow } from '@/features/projects/schema';
import { allocationRows } from '@/test/fixtures/allocations';
import { projectRows } from '@/test/fixtures/projects';
import { personRows } from '@/test/fixtures/people';
import { placementOf } from './placement';
import { personRowSchema, type PersonRow } from './schema';

const TODAY = '2026-10-20';

const person = (over: Record<string, unknown> = {}): PersonRow =>
  personRowSchema.parse({ ...personRows[0], id: 1, joinDate: null, leaveDate: null, ...over });

const project = (id: number, name: string, projectStatus = 'active'): ProjectRow =>
  projectRowSchema.parse({ ...projectRows[0], id, name, projectStatus });

/**
 * An entry for person 1: from `effectiveDate` their card (1 unless `over` says another) is on the project, or on the
 * bench when `on` is null.
 */
const entry = (
  id: number,
  on: { id: number; name: string } | null,
  effectiveDate: string,
  over: Record<string, unknown> = {}
): AllocationRow =>
  allocationRowSchema.parse({
    ...allocationRows[1],
    id,
    personId: 1,
    card: 1,
    removed: false,
    projectId: on?.id ?? null,
    effectiveDate,
    note: null,
    person: { id: 1, name: 'Ada Lovelace' },
    project: on,
    ...over,
  });

const apollo = project(10, 'Apollo');
const placement = (over: Partial<Parameters<typeof placementOf>[0]> = {}) =>
  placementOf({ person: person(), projects: [apollo], entries: [], today: TODAY, ...over });

describe('placementOf', () => {
  it('is on the project of the latest entry, since its date', () => {
    expect(
      placement({ entries: [entry(2, { id: 10, name: 'Apollo' }, '2026-03-12'), entry(1, null, '2025-11-03')] })
    ).toEqual({ kind: 'project', project: { id: 10, name: 'Apollo' }, since: '2026-03-12' });
  });

  it('is on the bench, since the date, when the latest entry is the bench', () => {
    expect(placement({ entries: [entry(1, null, '2025-11-03')] })).toEqual({
      kind: 'bench',
      since: '2025-11-03',
      note: null,
    });
  });

  it('is unallocated with no entry', () => {
    expect(placement()).toEqual({ kind: 'unallocated' });
  });

  it('is unallocated while every entry starts after today', () => {
    expect(placement({ entries: [entry(1, { id: 10, name: 'Apollo' }, '2026-10-21')] })).toEqual({
      kind: 'unallocated',
    });
  });

  it('is on a project from an entry dated today', () => {
    expect(placement({ entries: [entry(1, { id: 10, name: 'Apollo' }, TODAY)] })).toMatchObject({ kind: 'project' });
  });

  it('is on the bench, with a note naming the project, when it is on hold or completed', () => {
    for (const [status, label] of [
      ['on_hold', 'on hold'],
      ['completed', 'completed'],
    ]) {
      expect(
        placement({
          projects: [project(10, 'Apollo', status)],
          entries: [entry(1, { id: 10, name: 'Apollo' }, '2026-03-12')],
        })
      ).toEqual({ kind: 'bench', since: null, note: `Last on Apollo (${label})` });
    }
  });

  it('is on the bench, with a note, when the project is not in the list at all: it was deleted', () => {
    expect(placement({ projects: [], entries: [entry(1, { id: 10, name: 'Apollo' }, '2026-03-12')] })).toEqual({
      kind: 'bench',
      since: null,
      note: 'Last on Apollo (deleted)',
    });
  });

  it('has left when the Left date is before today, and is still here on the day', () => {
    expect(placement({ person: person({ leaveDate: '2026-10-19' }) })).toEqual({ kind: 'left', date: '2026-10-19' });
    expect(placement({ person: person({ leaveDate: TODAY }) })).toEqual({ kind: 'unallocated' });
  });

  it('has not joined when the Joined date is after today, and is here on the day', () => {
    expect(placement({ person: person({ joinDate: '2026-10-21' }) })).toEqual({
      kind: 'not-joined',
      date: '2026-10-21',
    });
    expect(placement({ person: person({ joinDate: TODAY }) })).toEqual({ kind: 'unallocated' });
  });

  describe('with several cards', () => {
    const borealis = project(11, 'Borealis');
    const both = [
      entry(3, { id: 11, name: 'Borealis' }, '2026-06-01', { card: 2 }),
      entry(1, { id: 10, name: 'Apollo' }, '2026-03-12'),
    ];

    it('says where every card is, the lowest card number first', () => {
      expect(placement({ projects: [apollo, borealis], entries: both })).toEqual({
        kind: 'several',
        cards: [
          { card: 1, project: { id: 10, name: 'Apollo' }, since: '2026-03-12', note: null },
          { card: 2, project: { id: 11, name: 'Borealis' }, since: '2026-06-01', note: null },
        ],
      });
    });

    it('includes a card on the bench, and a card with no entry yet (card 1 is there from the start)', () => {
      expect(placement({ entries: [entry(2, null, '2026-06-01', { card: 2 })] })).toEqual({
        kind: 'several',
        cards: [
          { card: 1, project: null, since: null, note: null },
          { card: 2, project: null, since: '2026-06-01', note: null },
        ],
      });
    });

    it('lists two cards on one project twice, as a copy just made is', () => {
      const copied = [
        entry(3, { id: 10, name: 'Apollo' }, '2026-10-20', { card: 2 }),
        entry(1, { id: 10, name: 'Apollo' }, '2026-03-12'),
      ];
      const result = placement({ entries: copied });
      expect(result).toMatchObject({ kind: 'several' });
      expect(result.kind === 'several' && result.cards.map((card) => card.project?.name)).toEqual(['Apollo', 'Apollo']);
    });

    it('puts a card whose project is not active on the bench with a note, keeping the project it is on underneath', () => {
      expect(placement({ projects: [apollo, project(11, 'Borealis', 'on_hold')], entries: both })).toEqual({
        kind: 'several',
        cards: [
          { card: 1, project: { id: 10, name: 'Apollo' }, since: '2026-03-12', note: null },
          { card: 2, project: null, since: null, note: 'Last on Borealis (on hold)' },
        ],
      });
    });

    it('is one card again once the other is removed', () => {
      const removed = entry(4, null, '2026-07-01', { card: 2, removed: true });
      expect(placement({ projects: [apollo, borealis], entries: [removed, ...both] })).toEqual({
        kind: 'project',
        project: { id: 10, name: 'Apollo' },
        since: '2026-03-12',
      });
    });

    it('is still left or not joined, whatever the cards were', () => {
      expect(placement({ person: person({ leaveDate: '2026-10-19' }), entries: both })).toEqual({
        kind: 'left',
        date: '2026-10-19',
      });
      expect(placement({ person: person({ joinDate: '2026-10-21' }), entries: both })).toEqual({
        kind: 'not-joined',
        date: '2026-10-21',
      });
    });
  });

  it('reads only the person’s own entries', () => {
    const someoneElse = allocationRowSchema.parse({ ...allocationRows[1], id: 7, personId: 2 });
    expect(placement({ entries: [someoneElse] })).toEqual({ kind: 'unallocated' });
  });
});
