import { leaveRows } from '@/test/fixtures/leaves';
import {
  LEAVE_TYPES,
  leaveDates,
  leaveFormSchema,
  leaveMatches,
  leaveRowsSchema,
  toLeaveBody,
  toLeaveFormValues,
  type LeaveFormValues,
} from './schema';

const [graceSick, adaWedding, graceEarned, adaTravel] = leaveRowsSchema.parse(leaveRows);

const form = (over: Partial<LeaveFormValues> = {}): LeaveFormValues => ({
  personId: '1',
  leaveType: 'casual',
  startDate: '2026-03-12',
  endDate: '2026-03-14',
  reason: '',
  ...over,
});

const messages = (values: LeaveFormValues) => {
  const result = leaveFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('LEAVE_TYPES', () => {
  it('lists the five types the service knows, with their labels', () => {
    expect(LEAVE_TYPES).toEqual([
      { value: 'casual', label: 'Casual' },
      { value: 'sick', label: 'Sick' },
      { value: 'earned', label: 'Earned' },
      { value: 'unpaid', label: 'Unpaid' },
      { value: 'other', label: 'Other' },
    ]);
  });
});

describe('leaveRowSchema', () => {
  it('keeps the leave with its person', () => {
    expect(adaWedding).toEqual({
      id: 3,
      personId: 1,
      person: { id: 1, name: 'Ada Lovelace' },
      startDate: '2026-03-12',
      endDate: '2026-03-14',
      leaveType: 'casual',
      reason: 'Family wedding',
    });
    expect(adaWedding).not.toHaveProperty('status');
    expect(adaWedding).not.toHaveProperty('createdDate');
  });

  it('turns a null reason into empty text', () => {
    expect(graceSick.reason).toBe('');
    expect(graceEarned.reason).toBe('');
    expect(adaTravel.reason).toBe('Travel');
  });

  it('reads a one-day leave', () => {
    expect(graceSick).toMatchObject({ startDate: '2026-08-21', endDate: '2026-08-21' });
  });

  it.each([
    ['an id', { ...leaveRows[1], id: undefined }],
    ['the person', { ...leaveRows[1], person: undefined }],
    ['a type the service does not know', { ...leaveRows[1], leaveType: 'holiday' }],
    ['no type', { ...leaveRows[1], leaveType: undefined }],
    ['a first day that is not a calendar day', { ...leaveRows[1], startDate: '12/03/2026' }],
    ['a last day that is not a real day', { ...leaveRows[1], endDate: '2026-02-31' }],
    ['no last day', { ...leaveRows[1], endDate: undefined }],
    ['a person id that is not a whole number', { ...leaveRows[1], personId: '1' }],
  ])('rejects a leave with %s', (_label, row) => {
    expect(leaveRowsSchema.safeParse([row]).success).toBe(false);
  });
});

describe('leaveDates', () => {
  it('says a range as the first day to the last', () => {
    expect(leaveDates(adaWedding)).toBe('12 Mar 2026 to 14 Mar 2026');
    expect(leaveDates(adaTravel)).toBe('24 Dec 2025 to 31 Dec 2025');
  });

  it('says one date for a single day', () => {
    expect(leaveDates(graceSick)).toBe('21 Aug 2026');
  });
});

describe('leaveMatches', () => {
  it('matches everything for a blank search', () => {
    expect(leaveMatches(adaWedding, '')).toBe(true);
    expect(leaveMatches(adaWedding, '   ')).toBe(true);
  });

  it('finds a leave by the name of the person, whatever the case', () => {
    expect(leaveMatches(adaWedding, 'LOVELACE')).toBe(true);
    expect(leaveMatches(adaWedding, 'hopper')).toBe(false);
  });

  it('finds a leave by its type, by the label or the word the service uses', () => {
    expect(leaveMatches(graceSick, 'sick')).toBe(true);
    expect(leaveMatches(graceSick, 'Sic')).toBe(true);
    expect(leaveMatches(adaTravel, 'unpaid')).toBe(true);
    expect(leaveMatches(adaWedding, 'sick')).toBe(false);
  });

  it('finds a leave by its reason', () => {
    expect(leaveMatches(adaWedding, 'wedding')).toBe(true);
    expect(leaveMatches(graceEarned, 'wedding')).toBe(false);
  });
});

describe('leaveFormSchema', () => {
  it('accepts a leave of several days, and of one day', () => {
    expect(messages(form())).toEqual([]);
    expect(messages(form({ startDate: '2026-03-12', endDate: '2026-03-12' }))).toEqual([]);
  });

  it('needs a person', () => {
    expect(messages(form({ personId: '' }))).toEqual(['Choose a person']);
  });

  it.each(['', 'holiday', 'Casual'])('refuses %j as a type', (leaveType) => {
    expect(messages(form({ leaveType }))).toEqual(['Choose a type']);
  });

  it.each(LEAVE_TYPES.map((type) => type.value))('accepts the type %s', (leaveType) => {
    expect(messages(form({ leaveType }))).toEqual([]);
  });

  it('needs both days', () => {
    expect(messages(form({ startDate: '' }))).toEqual(['First day is required']);
    expect(messages(form({ endDate: '' }))).toEqual(['Last day is required']);
    expect(messages(form({ startDate: '', endDate: '' }))).toEqual(['First day is required', 'Last day is required']);
  });

  it('refuses a last day before the first, and says so on the last day', () => {
    const result = leaveFormSchema.safeParse(form({ startDate: '2026-03-14', endDate: '2026-03-12' }));
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ['endDate'], message: 'The last day must not be before the first' }),
    ]);
  });

  it('accepts a reason, or none', () => {
    expect(messages(form({ reason: 'Family wedding' }))).toEqual([]);
    expect(messages(form({ reason: '' }))).toEqual([]);
  });
});

describe('toLeaveFormValues', () => {
  it('opens a new leave with nothing chosen and no days', () => {
    expect(toLeaveFormValues()).toEqual({ personId: '', leaveType: '', startDate: '', endDate: '', reason: '' });
  });

  it('writes a leave as text', () => {
    expect(toLeaveFormValues(adaWedding)).toEqual({
      personId: '1',
      leaveType: 'casual',
      startDate: '2026-03-12',
      endDate: '2026-03-14',
      reason: 'Family wedding',
    });
    expect(toLeaveFormValues(graceSick).reason).toBe('');
  });
});

describe('toLeaveBody', () => {
  it('sends the person as a number, the days and the type as chosen, and an empty reason as null', () => {
    expect(toLeaveBody(form({ personId: '7', leaveType: 'sick' }))).toEqual({
      personId: 7,
      startDate: '2026-03-12',
      endDate: '2026-03-14',
      leaveType: 'sick',
      reason: null,
    });
  });

  it('sends a reason that was written', () => {
    expect(toLeaveBody(form({ reason: 'Family wedding' })).reason).toBe('Family wedding');
  });

  it.each([graceSick, adaWedding, graceEarned, adaTravel])(
    'sends leave $id back as it was, so saving it unchanged cannot alter it',
    (row) => {
      const values = toLeaveFormValues(row);
      expect(messages(values)).toEqual([]);
      expect(toLeaveBody(values)).toEqual({
        personId: row.personId,
        startDate: row.startDate,
        endDate: row.endDate,
        leaveType: row.leaveType,
        reason: row.reason === '' ? null : row.reason,
      });
    }
  );
});
